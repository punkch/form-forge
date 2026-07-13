/**
 * Remembered publish-target storage, behind the persistence seam. A publish
 * target records where a workspace form was last published to (or imported
 * from) on a Central server/project, for one-click re-deploy and origin
 * pre-fill. Carries no credential material.
 */
import { newId } from '@/core/model/ids'

import { getPersistenceBackend } from './backend'
import type { PublishTargetRecord } from './db'

/** A target to record; the id is derived (natural-key upsert), never supplied. */
export type PublishTargetInput = Omit<PublishTargetRecord, 'id'>

export const listTargetsForForm = (formRecordId: string): Promise<PublishTargetRecord[]> =>
  getPersistenceBackend().listPublishTargets(formRecordId)

/**
 * Insert or update a publish target, keyed by the natural destination
 * (form + server + project + xmlFormId) rather than a synthetic id — so
 * re-publishing (or one-click re-deploy) to the same destination updates the
 * existing row in place instead of accumulating duplicates. Returns the stored
 * record.
 */
export const upsertTarget = async (input: PublishTargetInput): Promise<PublishTargetRecord> => {
  const backend = getPersistenceBackend()
  const existing = (await backend.listPublishTargets(input.formRecordId)).find(
    (t) => t.serverId === input.serverId && t.projectId === input.projectId && t.xmlFormId === input.xmlFormId
  )
  const record: PublishTargetRecord = { ...input, id: existing?.id ?? newId() }
  await backend.upsertPublishTarget(record)
  return record
}
