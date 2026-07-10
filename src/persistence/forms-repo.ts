import { newId } from '@/core/model/ids'
import { countQuestions } from '@/core/model/ops'
import type { AttachmentRef, FormDocument } from '@/core/model/types'
import type { ArchiveAttachment } from '@/core/workspace/archive'

import { getPersistenceBackend } from './backend'
import type { AttachmentRecord, FormRecord, SnapshotKind } from './db'

const SNAPSHOTS_PER_FORM = 20

/**
 * FormRecord fields derived purely from the document; the caller supplies
 * id/createdAt/updatedAt. Shared by createForm/saveForm and archive import so
 * the title/formId/version/questionCount derivation lives in one place.
 */
export const deriveRecordFields = (doc: FormDocument): Pick<FormRecord, 'title' | 'formId' | 'version' | 'questionCount'> => ({
  title: doc.settings.formTitle ?? 'Untitled form',
  formId: doc.settings.formId ?? '',
  version: doc.settings.version ?? '',
  questionCount: countQuestions(doc),
})

const toRecord = (id: string, doc: FormDocument, createdAt: number): FormRecord => ({
  id,
  ...deriveRecordFields(doc),
  createdAt,
  updatedAt: Date.now(),
  doc,
})

export interface RemappedAttachments {
  records: AttachmentRecord[]
  refs: AttachmentRef[]
}

/**
 * Mint fresh attachment ids for a new form record: builds the AttachmentRecords
 * to insert and the doc.attachments refs that point at them. Shared by
 * duplicateForm (entries are existing AttachmentRecords, joined by id) and
 * archive import (entries are archive attachments, joined by filename).
 *
 * `keyOfEntry`/`keyOfRef` extract the join key each side shares and `toRecord`
 * builds the stored record from an entry plus its freshly minted id. A ref with
 * no minted id is kept as-is, or dropped when `dropUnmatched` is set (import,
 * where an absent blob would otherwise leave a dangling ref).
 */
export const remapAttachments = <T>(
  refs: AttachmentRef[],
  entries: T[],
  spec: {
    keyOfEntry: (entry: T) => string
    keyOfRef: (ref: AttachmentRef) => string
    toRecord: (entry: T, id: string) => AttachmentRecord
    dropUnmatched?: boolean
  }
): RemappedAttachments => {
  const idByKey = new Map<string, string>()
  const records: AttachmentRecord[] = []
  for (const entry of entries) {
    const id = newId()
    idByKey.set(spec.keyOfEntry(entry), id)
    records.push(spec.toRecord(entry, id))
  }
  const remapped: AttachmentRef[] = []
  for (const ref of refs) {
    const minted = idByKey.get(spec.keyOfRef(ref))
    if (minted !== undefined) remapped.push({ ...ref, id: minted })
    else if (spec.dropUnmatched !== true) remapped.push(ref)
  }
  return { records, refs: remapped }
}

/**
 * Create a fresh form record from a document plus archive-style attachment
 * blobs, in one atomic backend write (importForm). Attachment ids are freshly
 * minted and the doc's attachment refs are remapped onto them by filename; a
 * ref whose blob is absent from `attachments` is dropped (dropUnmatched) so no
 * ref dangles. The document is cloned, so the caller's object is never mutated.
 *
 * Shared canonical path for "bring an external form into storage": the embed
 * bridge's load-form and workspace archive import both go through here.
 */
export const createFormWithArchiveAttachments = async (
  doc: FormDocument,
  attachments: ArchiveAttachment[],
  opts: { createdAt?: number } = {}
): Promise<FormRecord> => {
  const cloned = structuredClone(doc)
  const now = Date.now()
  const record: FormRecord = {
    id: newId(),
    ...deriveRecordFields(cloned),
    createdAt: opts.createdAt ?? now,
    updatedAt: now,
    doc: cloned,
  }
  const { records, refs } = remapAttachments(cloned.attachments, attachments, {
    keyOfEntry: (att) => att.filename,
    keyOfRef: (ref) => ref.filename,
    toRecord: (att, id) => ({
      id,
      formRecordId: record.id,
      filename: att.filename,
      mediatype: att.mediatype,
      size: att.blob.size,
      blob: att.blob,
    }),
    dropUnmatched: true,
  })
  cloned.attachments = refs
  await getPersistenceBackend().importForm(record, records)
  return record
}

export const listForms = (): Promise<FormRecord[]> =>
  getPersistenceBackend().listForms()

export const getForm = (id: string): Promise<FormRecord | undefined> =>
  getPersistenceBackend().getForm(id)

export const createForm = async (doc: FormDocument): Promise<FormRecord> => {
  const record = toRecord(newId(), doc, Date.now())
  await getPersistenceBackend().addForm(record)
  return record
}

export const saveForm = async (id: string, doc: FormDocument): Promise<void> => {
  // No createdAt read-back: putForm preserves the stored createdAt itself (and
  // rejects an unknown id). The createdAt passed here is a placeholder putForm
  // overwrites. This keeps the ~1.5s autosave from cloning the whole stored
  // doc on the memory backend just to read one timestamp.
  await getPersistenceBackend().putForm(toRecord(id, doc, Date.now()))
}

export const deleteForm = async (id: string): Promise<void> => {
  await getPersistenceBackend().deleteFormCascade(id)
}

export const duplicateForm = async (id: string): Promise<FormRecord | undefined> => {
  const backend = getPersistenceBackend()
  const existing = await backend.getForm(id)
  if (existing === undefined) return undefined
  const doc = structuredClone(existing.doc)
  doc.settings.formTitle = `${doc.settings.formTitle ?? 'Untitled form'} (copy)`
  doc.settings.formId = `${doc.settings.formId ?? 'form'}_copy`
  const record = await createForm(doc)
  // Attachments are duplicated so deleting one form never orphans the other.
  const attachments = await backend.listAttachments(id)
  const { records, refs } = remapAttachments(record.doc.attachments, attachments, {
    keyOfEntry: (att) => att.id,
    keyOfRef: (ref) => ref.id,
    toRecord: (att, newAttId) => ({ ...att, id: newAttId, formRecordId: record.id }),
  })
  await backend.bulkAddAttachments(records)
  record.doc.attachments = refs
  await saveForm(record.id, record.doc)
  return record
}

export const addSnapshot = async (formRecordId: string, doc: FormDocument, kind: SnapshotKind): Promise<void> => {
  const backend = getPersistenceBackend()
  await backend.addSnapshot({ id: newId(), formRecordId, createdAt: Date.now(), kind, doc: structuredClone(doc) })
  const all = await backend.listSnapshots(formRecordId)
  const excess = all.length - SNAPSHOTS_PER_FORM
  if (excess > 0) {
    await backend.bulkDeleteSnapshots(all.slice(0, excess).map((s) => s.id))
  }
}

export const renameForm = async (id: string, title: string): Promise<void> => {
  const existing = await getPersistenceBackend().getForm(id)
  if (existing === undefined) return
  existing.doc.settings.formTitle = title
  await saveForm(id, existing.doc)
}
