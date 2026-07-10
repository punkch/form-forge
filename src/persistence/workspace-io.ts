/**
 * Persistence wiring for workspace archives: gathers FormRecords (with the
 * attachment blobs their documents actually reference) for export, and
 * imports parsed archive forms as brand-new records — import never
 * overwrites existing data.
 */
import { newId } from '@/core/model/ids'
import { error, warning, type Issue } from '@/core/validate/issues'
import type { ArchiveAttachment, ArchiveFormInput, ParsedArchiveForm } from '@/core/workspace/archive'

import { db, type AttachmentRecord, type FormRecord } from './db'
import { deriveRecordFields, listForms, remapAttachments } from './forms-repo'

/**
 * Read forms (all, or the given record ids) and their attachments for
 * archiving. Blobs are looked up strictly via doc.attachments[].id, so
 * orphaned attachment records never leak into an export.
 */
export const gatherArchiveForms = async (recordIds?: string[]): Promise<ArchiveFormInput[]> => {
  const records = recordIds === undefined
    ? await db.forms.orderBy('updatedAt').reverse().toArray()
    : (await db.forms.bulkGet(recordIds)).filter((r): r is FormRecord => r !== undefined)

  // One bulk read of every referenced blob, then assemble per form. Blobs are
  // still matched strictly by doc.attachments[].id, so orphaned attachment
  // records never leak into an export and missing blobs are skipped.
  const refIds = records.flatMap((r) => r.doc.attachments.map((ref) => ref.id))
  const byId = new Map<string, AttachmentRecord>()
  for (const att of await db.attachments.bulkGet(refIds)) {
    if (att !== undefined) byId.set(att.id, att)
  }

  return records.map((record) => ({
    recordId: record.id,
    meta: {
      title: record.title,
      formId: record.formId,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
    doc: record.doc,
    attachments: record.doc.attachments.flatMap((ref): ArchiveAttachment[] => {
      const att = byId.get(ref.id)
      return att === undefined ? [] : [{ filename: att.filename, mediatype: att.mediatype, blob: att.blob }]
    }),
  }))
}

export interface ImportArchiveResult {
  imported: number
  issues: Issue[]
}

/**
 * Import parsed archive forms as new records. Each form runs in its own rw
 * transaction so one bad form never rolls back the rest. Record and
 * attachment ids are always freshly minted (attachment refs are remapped
 * into the doc exactly like duplicateForm does); meta.createdAt is
 * preserved while updatedAt becomes the import time. A form_id already
 * present in the library only warns — the form is imported anyway.
 */
export const importArchiveForms = async (parsed: ParsedArchiveForm[]): Promise<ImportArchiveResult> => {
  const issues: Issue[] = []
  let imported = 0
  // Read existing form_ids once (updated as we go) instead of a full-table
  // scan inside every per-form transaction.
  const existingFormIds = new Set((await listForms()).map((r) => r.formId))
  for (const form of parsed) {
    try {
      const record = await db.transaction('rw', [db.forms, db.attachments], async () => {
        const doc = structuredClone(form.doc)
        const rec: FormRecord = {
          id: newId(),
          ...deriveRecordFields(doc),
          createdAt: form.meta.createdAt ?? Date.now(),
          updatedAt: Date.now(),
          doc,
        }
        // Attachment ids are freshly minted and the doc refs remapped onto them;
        // a ref whose blob is absent from the archive is dropped, not kept with
        // a stale id (which would dangle).
        const { records, refs } = remapAttachments(doc.attachments, form.attachments, {
          keyOfEntry: (att) => att.filename,
          keyOfRef: (ref) => ref.filename,
          toRecord: (att, id) => ({
            id,
            formRecordId: rec.id,
            filename: att.filename,
            mediatype: att.mediatype,
            size: att.blob.size,
            blob: att.blob,
          }),
          dropUnmatched: true,
        })
        doc.attachments = refs
        await db.attachments.bulkAdd(records)
        await db.forms.add(rec)
        return rec
      })
      imported++
      const collides = record.formId !== '' && existingFormIds.has(record.formId)
      if (record.formId !== '') existingFormIds.add(record.formId)
      if (collides) {
        issues.push(warning(
          'workspace.duplicate-form-id',
          `"${record.title}" was imported, but its form ID "${record.formId}" is already used by another form in the library.`
        ))
      }
    } catch (err) {
      issues.push(error(
        'workspace.import-failed',
        `"${form.meta.title}" could not be imported (${err instanceof Error ? err.message : String(err)}).`
      ))
    }
  }
  return { imported, issues }
}
