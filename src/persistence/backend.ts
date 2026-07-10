/**
 * Persistence seam: every repo (forms-repo, attachments-repo, workspace-io)
 * talks to storage exclusively through the active PersistenceBackend, so the
 * repos' exported signatures never change when storage does. The default is
 * the Dexie/IndexedDB implementation below; embed mode installs the Map-based
 * backend from ./memory-backend.ts so nothing touches the user's browser
 * library unless the host asks for `persistence: 'local'`.
 */
import { db, type AttachmentRecord, type FormRecord, type SnapshotRecord } from './db'

export interface PersistenceBackend {
  /** All forms, most recently updated first. */
  listForms: () => Promise<FormRecord[]>
  getForm: (id: string) => Promise<FormRecord | undefined>
  /** Positional lookup — unknown ids yield undefined holes. */
  bulkGetForms: (ids: string[]) => Promise<Array<FormRecord | undefined>>
  /** Insert a new form; rejects when the id already exists. */
  addForm: (record: FormRecord) => Promise<void>
  /** Update an existing form, preserving its stored `createdAt` (the caller's
   * createdAt on `record` is ignored); rejects when no record with that id
   * exists, so a stray autosave never resurrects a deleted form. */
  putForm: (record: FormRecord) => Promise<void>
  /** Delete a form together with its attachments and snapshots. */
  deleteFormCascade: (id: string) => Promise<void>
  /** Atomically add one new form and its attachment records (archive import):
   * a failure must leave neither the form nor any of its attachments behind. */
  importForm: (record: FormRecord, attachments: AttachmentRecord[]) => Promise<void>

  listAttachments: (formRecordId: string) => Promise<AttachmentRecord[]>
  getAttachment: (id: string) => Promise<AttachmentRecord | undefined>
  /** Positional lookup — unknown ids yield undefined holes. */
  bulkGetAttachments: (ids: string[]) => Promise<Array<AttachmentRecord | undefined>>
  addAttachment: (record: AttachmentRecord) => Promise<void>
  bulkAddAttachments: (records: AttachmentRecord[]) => Promise<void>
  deleteAttachment: (id: string) => Promise<void>
  bulkDeleteAttachments: (ids: string[]) => Promise<void>

  addSnapshot: (record: SnapshotRecord) => Promise<void>
  /** Snapshots of one form, oldest first. */
  listSnapshots: (formRecordId: string) => Promise<SnapshotRecord[]>
  bulkDeleteSnapshots: (ids: string[]) => Promise<void>
}

/** The normal browser-library backend, backed by Dexie/IndexedDB. */
export const dexieBackend: PersistenceBackend = {
  listForms: () => db.forms.orderBy('updatedAt').reverse().toArray(),
  getForm: (id) => db.forms.get(id),
  bulkGetForms: (ids) => db.forms.bulkGet(ids),
  addForm: async (record) => { await db.forms.add(record) },
  putForm: async (record) => {
    const existing = await db.forms.get(record.id)
    if (existing === undefined) throw new Error(`Form record ${record.id} does not exist`)
    await db.forms.put({ ...record, createdAt: existing.createdAt })
  },
  deleteFormCascade: async (id) => {
    await db.transaction('rw', [db.forms, db.attachments, db.snapshots], async () => {
      await db.forms.delete(id)
      await db.attachments.where('formRecordId').equals(id).delete()
      await db.snapshots.where('formRecordId').equals(id).delete()
    })
  },
  importForm: async (record, attachments) => {
    await db.transaction('rw', [db.forms, db.attachments], async () => {
      await db.attachments.bulkAdd(attachments)
      await db.forms.add(record)
    })
  },

  listAttachments: (formRecordId) => db.attachments.where('formRecordId').equals(formRecordId).toArray(),
  getAttachment: (id) => db.attachments.get(id),
  bulkGetAttachments: (ids) => db.attachments.bulkGet(ids),
  addAttachment: async (record) => { await db.attachments.add(record) },
  bulkAddAttachments: async (records) => { await db.attachments.bulkAdd(records) },
  deleteAttachment: async (id) => { await db.attachments.delete(id) },
  bulkDeleteAttachments: async (ids) => { await db.attachments.bulkDelete(ids) },

  addSnapshot: async (record) => { await db.snapshots.add(record) },
  listSnapshots: (formRecordId) => db.snapshots.where('formRecordId').equals(formRecordId).sortBy('createdAt'),
  bulkDeleteSnapshots: async (ids) => { await db.snapshots.bulkDelete(ids) },
}

let activeBackend: PersistenceBackend = dexieBackend

export const getPersistenceBackend = (): PersistenceBackend => activeBackend

export const setPersistenceBackend = (backend: PersistenceBackend): void => {
  activeBackend = backend
}
