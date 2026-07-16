import { newId } from '@/core/model/ids'

import { getPersistenceBackend } from './backend'
import type { AttachmentRecord } from './db'

export const listAttachments = (formRecordId: string): Promise<AttachmentRecord[]> =>
  getPersistenceBackend().listAttachments(formRecordId)

export const getAttachment = (id: string): Promise<AttachmentRecord | undefined> =>
  getPersistenceBackend().getAttachment(id)

export const addAttachment = async (
  formRecordId: string,
  filename: string,
  blob: Blob
): Promise<AttachmentRecord> => {
  const record: AttachmentRecord = {
    id: newId(),
    formRecordId,
    filename,
    mediatype: blob.type || 'application/octet-stream',
    size: blob.size,
    blob,
  }
  await getPersistenceBackend().addAttachment(record)
  return record
}

export const deleteAttachment = (id: string): Promise<void> =>
  getPersistenceBackend().deleteAttachment(id)

/** Update a stored attachment's filename in place (rename). */
export const renameAttachment = (id: string, filename: string): Promise<void> =>
  getPersistenceBackend().renameAttachment(id, filename)

/** Remove attachment records no longer referenced by the form document. */
export const pruneOrphans = async (formRecordId: string, referencedIds: Set<string>): Promise<void> => {
  const all = await listAttachments(formRecordId)
  const orphans = all.filter((a) => !referencedIds.has(a.id))
  if (orphans.length > 0) await getPersistenceBackend().bulkDeleteAttachments(orphans.map((a) => a.id))
}
