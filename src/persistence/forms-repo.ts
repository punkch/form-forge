import { newId } from '@/core/model/ids'
import { countQuestions } from '@/core/model/ops'
import type { AttachmentRef, FormDocument } from '@/core/model/types'

import { db, type AttachmentRecord, type FormRecord, type SnapshotKind } from './db'

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

export const listForms = (): Promise<FormRecord[]> =>
  db.forms.orderBy('updatedAt').reverse().toArray()

export const getForm = (id: string): Promise<FormRecord | undefined> =>
  db.forms.get(id)

export const createForm = async (doc: FormDocument): Promise<FormRecord> => {
  const record = toRecord(newId(), doc, Date.now())
  await db.forms.add(record)
  return record
}

export const saveForm = async (id: string, doc: FormDocument): Promise<void> => {
  const existing = await db.forms.get(id)
  if (existing === undefined) throw new Error(`Form record ${id} does not exist`)
  await db.forms.put({ ...toRecord(id, doc, existing.createdAt), createdAt: existing.createdAt })
}

export const deleteForm = async (id: string): Promise<void> => {
  await db.transaction('rw', [db.forms, db.attachments, db.snapshots], async () => {
    await db.forms.delete(id)
    await db.attachments.where('formRecordId').equals(id).delete()
    await db.snapshots.where('formRecordId').equals(id).delete()
  })
}

export const duplicateForm = async (id: string): Promise<FormRecord | undefined> => {
  const existing = await db.forms.get(id)
  if (existing === undefined) return undefined
  const doc = structuredClone(existing.doc)
  doc.settings.formTitle = `${doc.settings.formTitle ?? 'Untitled form'} (copy)`
  doc.settings.formId = `${doc.settings.formId ?? 'form'}_copy`
  const record = await createForm(doc)
  // Attachments are duplicated so deleting one form never orphans the other.
  const attachments = await db.attachments.where('formRecordId').equals(id).toArray()
  const { records, refs } = remapAttachments(record.doc.attachments, attachments, {
    keyOfEntry: (att) => att.id,
    keyOfRef: (ref) => ref.id,
    toRecord: (att, newAttId) => ({ ...att, id: newAttId, formRecordId: record.id }),
  })
  await db.attachments.bulkAdd(records)
  record.doc.attachments = refs
  await saveForm(record.id, record.doc)
  return record
}

export const addSnapshot = async (formRecordId: string, doc: FormDocument, kind: SnapshotKind): Promise<void> => {
  await db.snapshots.add({ id: newId(), formRecordId, createdAt: Date.now(), kind, doc: structuredClone(doc) })
  const all = await db.snapshots.where('formRecordId').equals(formRecordId).sortBy('createdAt')
  const excess = all.length - SNAPSHOTS_PER_FORM
  if (excess > 0) {
    await db.snapshots.bulkDelete(all.slice(0, excess).map((s) => s.id))
  }
}

export const renameForm = async (id: string, title: string): Promise<void> => {
  const existing = await db.forms.get(id)
  if (existing === undefined) return
  existing.doc.settings.formTitle = title
  await saveForm(id, existing.doc)
}
