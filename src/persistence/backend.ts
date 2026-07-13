/**
 * Persistence seam: every repo (forms-repo, attachments-repo, workspace-io)
 * talks to storage exclusively through the active PersistenceBackend, so the
 * repos' exported signatures never change when storage does. The default is
 * the Dexie/IndexedDB implementation below; embed mode installs the Map-based
 * backend from ./memory-backend.ts so nothing touches the user's browser
 * library unless the host asks for `persistence: 'local'`.
 */
import {
  db,
  type AttachmentRecord,
  type CentralServerRecord,
  type CentralVaultRecord,
  type FormRecord,
  type PublishTargetRecord,
  type SnapshotRecord,
} from './db'

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
  /** Delete a form together with its attachments, snapshots and publish
   * targets. */
  deleteFormCascade: (id: string) => Promise<void>
  /** Atomically add one new form and its attachment records (archive import):
   * a failure must leave neither the form nor any of its attachments behind. */
  importForm: (record: FormRecord, attachments: AttachmentRecord[]) => Promise<void>
  /** Atomically overwrite an existing form and its attachments, keeping the
   * record id and its stored `createdAt` (the caller's createdAt is ignored,
   * mirroring putForm). Old attachments are replaced by the supplied set;
   * snapshots and publish targets are left untouched (a collision "replace"
   * keeps the form's identity and its remembered targets). Rejects when no
   * record with that id exists. */
  replaceForm: (record: FormRecord, attachments: AttachmentRecord[]) => Promise<void>

  /** All registered Central servers, in primary-key order. */
  listCentralServers: () => Promise<CentralServerRecord[]>
  getCentralServer: (id: string) => Promise<CentralServerRecord | undefined>
  /** Insert a new server; rejects when the id already exists. */
  addCentralServer: (record: CentralServerRecord) => Promise<void>
  /** Insert-or-replace a server by id. */
  putCentralServer: (record: CentralServerRecord) => Promise<void>
  /** Delete a server together with every publish target that points at it. */
  deleteCentralServer: (id: string) => Promise<void>

  /** The single global vault-meta row, or undefined before first use. */
  getVaultMeta: () => Promise<CentralVaultRecord | undefined>
  putVaultMeta: (record: CentralVaultRecord) => Promise<void>
  /** Forgotten-passphrase reset: atomically write the new vault meta AND wipe
   * the encrypted password off every server row, keeping the server rows. */
  resetVault: (meta: CentralVaultRecord) => Promise<void>

  /** A form's remembered publish targets. */
  listPublishTargets: (formRecordId: string) => Promise<PublishTargetRecord[]>
  /** Insert-or-replace a publish target by id. */
  upsertPublishTarget: (record: PublishTargetRecord) => Promise<void>

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
    await db.transaction('rw', [db.forms, db.attachments, db.snapshots, db.publishTargets], async () => {
      await db.forms.delete(id)
      await db.attachments.where('formRecordId').equals(id).delete()
      await db.snapshots.where('formRecordId').equals(id).delete()
      await db.publishTargets.where('formRecordId').equals(id).delete()
    })
  },
  importForm: async (record, attachments) => {
    await db.transaction('rw', [db.forms, db.attachments], async () => {
      await db.attachments.bulkAdd(attachments)
      await db.forms.add(record)
    })
  },
  replaceForm: async (record, attachments) => {
    await db.transaction('rw', [db.forms, db.attachments], async () => {
      const existing = await db.forms.get(record.id)
      if (existing === undefined) throw new Error(`Form record ${record.id} does not exist`)
      await db.attachments.where('formRecordId').equals(record.id).delete()
      await db.attachments.bulkAdd(attachments)
      await db.forms.put({ ...record, createdAt: existing.createdAt })
    })
  },

  listCentralServers: () => db.centralServers.toArray(),
  getCentralServer: (id) => db.centralServers.get(id),
  addCentralServer: async (record) => { await db.centralServers.add(record) },
  putCentralServer: async (record) => { await db.centralServers.put(record) },
  deleteCentralServer: async (id) => {
    await db.transaction('rw', [db.centralServers, db.publishTargets], async () => {
      await db.centralServers.delete(id)
      await db.publishTargets.where('serverId').equals(id).delete()
    })
  },

  getVaultMeta: () => db.centralVault.get('vault'),
  putVaultMeta: async (record) => { await db.centralVault.put(record) },
  resetVault: async (meta) => {
    await db.transaction('rw', [db.centralVault, db.centralServers], async () => {
      await db.centralVault.put(meta)
      await db.centralServers.toCollection().modify((server) => { delete server.encryptedPassword })
    })
  },

  listPublishTargets: (formRecordId) => db.publishTargets.where('formRecordId').equals(formRecordId).toArray(),
  upsertPublishTarget: async (record) => { await db.publishTargets.put(record) },

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
