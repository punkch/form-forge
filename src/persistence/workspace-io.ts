/**
 * Persistence wiring for workspace archives: gathers FormRecords (with the
 * attachment blobs their documents actually reference) for export, and
 * imports parsed archive forms as brand-new records — import never
 * overwrites existing data.
 */
import { error, warning, type Issue } from '@/core/validate/issues'
import type { ArchiveAttachment, ArchiveFormInput, ParsedArchiveForm } from '@/core/workspace/archive'

import { getPersistenceBackend } from './backend'
import type { AttachmentRecord, FormRecord } from './db'
import { createFormWithArchiveAttachments, listForms } from './forms-repo'

/**
 * Read forms (all, or the given record ids) and their attachments for
 * archiving. Blobs are looked up strictly via doc.attachments[].id, so
 * orphaned attachment records never leak into an export.
 */
export const gatherArchiveForms = async (recordIds?: string[]): Promise<ArchiveFormInput[]> => {
  const backend = getPersistenceBackend()
  const records = recordIds === undefined
    ? await backend.listForms()
    : (await backend.bulkGetForms(recordIds)).filter((r): r is FormRecord => r !== undefined)

  // One bulk read of every referenced blob, then assemble per form. Blobs are
  // still matched strictly by doc.attachments[].id, so orphaned attachment
  // records never leak into an export and missing blobs are skipped.
  const refIds = records.flatMap((r) => r.doc.attachments.map((ref) => ref.id))
  const byId = new Map<string, AttachmentRecord>()
  for (const att of await backend.bulkGetAttachments(refIds)) {
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
 * Import parsed archive forms as new records. Each form goes through
 * createFormWithArchiveAttachments — one atomic backend write with freshly
 * minted record/attachment ids and filename-keyed attachment remap — so one
 * bad form never rolls back the rest. meta.createdAt is preserved while
 * updatedAt becomes the import time. A form_id already present in the library
 * only warns — the form is imported anyway.
 */
export const importArchiveForms = async (parsed: ParsedArchiveForm[]): Promise<ImportArchiveResult> => {
  const issues: Issue[] = []
  let imported = 0
  // Read existing form_ids once (updated as we go) instead of a full-table
  // scan for every imported form.
  const existingFormIds = new Set((await listForms()).map((r) => r.formId))
  for (const form of parsed) {
    try {
      const record = await createFormWithArchiveAttachments(form.doc, form.attachments, {
        createdAt: form.meta.createdAt,
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
