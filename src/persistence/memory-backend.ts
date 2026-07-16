/**
 * Map-based PersistenceBackend for embed mode: the host application owns
 * durability, so nothing is ever written to IndexedDB. Form and snapshot
 * records are cloned on both write and read — the same aliasing behavior
 * Dexie's structured-clone storage gives callers — so stored state can never
 * be mutated through a retained reference. Attachment records are shallow
 * copies: their Blob payloads are immutable and safe to share.
 */
import type { PersistenceBackend } from './backend'
import type {
  AttachmentRecord,
  CentralServerRecord,
  CentralVaultRecord,
  FormRecord,
  PublishTargetRecord,
  SnapshotRecord,
} from './db'

const cloneAttachment = (record: AttachmentRecord): AttachmentRecord => ({ ...record })

/** Primary-key (id) ascending, matching Dexie's Table.toArray() ordering. */
const byId = (a: { id: string }, b: { id: string }): number =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0

export const createMemoryBackend = (): PersistenceBackend => {
  const forms = new Map<string, FormRecord>()
  const attachments = new Map<string, AttachmentRecord>()
  const snapshots = new Map<string, SnapshotRecord>()
  const centralServers = new Map<string, CentralServerRecord>()
  const publishTargets = new Map<string, PublishTargetRecord>()
  let vaultMeta: CentralVaultRecord | undefined

  const requireNew = (map: Map<string, unknown>, id: string, label: string): void => {
    if (map.has(id)) throw new Error(`${label} ${id} already exists`)
  }

  const deleteWhereForm = (map: Map<string, { formRecordId: string }>, formRecordId: string): void => {
    for (const [id, record] of map) {
      if (record.formRecordId === formRecordId) map.delete(id)
    }
  }

  return {
    listForms: async () =>
      [...forms.values()].sort((a, b) => b.updatedAt - a.updatedAt).map((r) => structuredClone(r)),
    getForm: async (id) => {
      const record = forms.get(id)
      return record === undefined ? undefined : structuredClone(record)
    },
    bulkGetForms: async (ids) => ids.map((id) => {
      const record = forms.get(id)
      return record === undefined ? undefined : structuredClone(record)
    }),
    addForm: async (record) => {
      requireNew(forms, record.id, 'Form')
      forms.set(record.id, structuredClone(record))
    },
    putForm: async (record) => {
      // Read the raw stored entry (no clone) just to preserve createdAt and to
      // reject an unknown id — autosave reads this every ~1.5s, so cloning the
      // whole stored doc here would be pure waste.
      const existing = forms.get(record.id)
      if (existing === undefined) throw new Error(`Form ${record.id} does not exist`)
      const stored = structuredClone(record)
      stored.createdAt = existing.createdAt
      forms.set(record.id, stored)
    },
    deleteFormCascade: async (id) => {
      forms.delete(id)
      deleteWhereForm(attachments, id)
      deleteWhereForm(snapshots, id)
      deleteWhereForm(publishTargets, id)
    },
    importForm: async (record, attachmentRecords) => {
      // Validate every id up front so a duplicate can never leave a
      // half-imported form behind (Dexie gets this from its transaction).
      requireNew(forms, record.id, 'Form')
      for (const att of attachmentRecords) requireNew(attachments, att.id, 'Attachment')
      for (const att of attachmentRecords) attachments.set(att.id, cloneAttachment(att))
      forms.set(record.id, structuredClone(record))
    },
    replaceForm: async (record, attachmentRecords) => {
      // Overwrite an existing form: keep its id and stored createdAt (like
      // putForm), replace its attachments, and leave snapshots and publish
      // targets untouched. Freshly minted attachment ids won't collide.
      const existing = forms.get(record.id)
      if (existing === undefined) throw new Error(`Form ${record.id} does not exist`)
      deleteWhereForm(attachments, record.id)
      for (const att of attachmentRecords) attachments.set(att.id, cloneAttachment(att))
      const stored = structuredClone(record)
      stored.createdAt = existing.createdAt
      forms.set(record.id, stored)
    },

    listCentralServers: async () =>
      [...centralServers.values()].sort(byId).map((s) => structuredClone(s)),
    getCentralServer: async (id) => {
      const record = centralServers.get(id)
      return record === undefined ? undefined : structuredClone(record)
    },
    addCentralServer: async (record) => {
      requireNew(centralServers, record.id, 'Central server')
      centralServers.set(record.id, structuredClone(record))
    },
    putCentralServer: async (record) => {
      centralServers.set(record.id, structuredClone(record))
    },
    deleteCentralServer: async (id) => {
      centralServers.delete(id)
      for (const [targetId, target] of publishTargets) {
        if (target.serverId === id) publishTargets.delete(targetId)
      }
    },

    getVaultMeta: async () => (vaultMeta === undefined ? undefined : structuredClone(vaultMeta)),
    putVaultMeta: async (record) => { vaultMeta = structuredClone(record) },
    resetVault: async (meta) => {
      vaultMeta = structuredClone(meta)
      for (const [id, server] of centralServers) {
        const next = structuredClone(server)
        delete next.encryptedPassword
        centralServers.set(id, next)
      }
    },

    listPublishTargets: async (formRecordId) =>
      [...publishTargets.values()].filter((t) => t.formRecordId === formRecordId).sort(byId).map((t) => structuredClone(t)),
    upsertPublishTarget: async (record) => {
      publishTargets.set(record.id, structuredClone(record))
    },

    listAttachments: async (formRecordId) =>
      [...attachments.values()].filter((a) => a.formRecordId === formRecordId).map(cloneAttachment),
    getAttachment: async (id) => {
      const record = attachments.get(id)
      return record === undefined ? undefined : cloneAttachment(record)
    },
    bulkGetAttachments: async (ids) => ids.map((id) => {
      const record = attachments.get(id)
      return record === undefined ? undefined : cloneAttachment(record)
    }),
    addAttachment: async (record) => {
      requireNew(attachments, record.id, 'Attachment')
      attachments.set(record.id, cloneAttachment(record))
    },
    bulkAddAttachments: async (records) => {
      for (const record of records) requireNew(attachments, record.id, 'Attachment')
      for (const record of records) attachments.set(record.id, cloneAttachment(record))
    },
    deleteAttachment: async (id) => { attachments.delete(id) },
    bulkDeleteAttachments: async (ids) => {
      for (const id of ids) attachments.delete(id)
    },
    renameAttachment: async (id, filename) => {
      const record = attachments.get(id)
      if (record === undefined) throw new Error(`Attachment ${id} does not exist`)
      attachments.set(id, { ...record, filename })
    },

    addSnapshot: async (record) => {
      requireNew(snapshots, record.id, 'Snapshot')
      snapshots.set(record.id, structuredClone(record))
    },
    listSnapshots: async (formRecordId) =>
      [...snapshots.values()]
        .filter((s) => s.formRecordId === formRecordId)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((s) => structuredClone(s)),
    bulkDeleteSnapshots: async (ids) => {
      for (const id of ids) snapshots.delete(id)
    },
  }
}
