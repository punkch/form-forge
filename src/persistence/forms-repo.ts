import { newId } from '@/core/model/ids'
import { countQuestions } from '@/core/model/ops'
import type { FormDocument } from '@/core/model/types'

import { db, type FormRecord, type SnapshotKind } from './db'

const SNAPSHOTS_PER_FORM = 20

const toRecord = (id: string, doc: FormDocument, createdAt: number): FormRecord => ({
  id,
  title: doc.settings.formTitle ?? 'Untitled form',
  formId: doc.settings.formId ?? '',
  version: doc.settings.version ?? '',
  questionCount: countQuestions(doc),
  createdAt,
  updatedAt: Date.now(),
  doc,
})

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
  const idMap = new Map<string, string>()
  for (const att of attachments) {
    const newAttId = newId()
    idMap.set(att.id, newAttId)
    await db.attachments.add({ ...att, id: newAttId, formRecordId: record.id })
  }
  record.doc.attachments = record.doc.attachments.map((ref) => ({
    ...ref,
    id: idMap.get(ref.id) ?? ref.id,
  }))
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
