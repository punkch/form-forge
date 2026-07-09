import { newId } from '@/core/model/ids'

import { db, type AttachmentRecord } from './db'

export const listAttachments = (formRecordId: string): Promise<AttachmentRecord[]> =>
  db.attachments.where('formRecordId').equals(formRecordId).toArray()

export const getAttachment = (id: string): Promise<AttachmentRecord | undefined> =>
  db.attachments.get(id)

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
  await db.attachments.add(record)
  return record
}

export const deleteAttachment = (id: string): Promise<void> =>
  db.attachments.delete(id)

/** Remove attachment records no longer referenced by the form document. */
export const pruneOrphans = async (formRecordId: string, referencedIds: Set<string>): Promise<void> => {
  const all = await listAttachments(formRecordId)
  const orphans = all.filter((a) => !referencedIds.has(a.id))
  if (orphans.length > 0) await db.attachments.bulkDelete(orphans.map((a) => a.id))
}
