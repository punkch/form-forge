import { beforeEach, describe, expect, it } from 'vitest'

import { newDocument } from '@/core/model/factory'
import type { FormDocument } from '@/core/model/types'
import type { ArchiveAttachment } from '@/core/workspace/archive'

import { backendCases } from '../../tests/helpers/backends'
import * as attachmentsRepo from './attachments-repo'
import * as formsRepo from './forms-repo'
import * as targetsRepo from './publish-targets-repo'
import type { PublishTargetInput } from './publish-targets-repo'

const target = (over: Partial<PublishTargetInput> = {}): PublishTargetInput => ({
  formRecordId: 'f',
  serverId: 's',
  projectId: 1,
  xmlFormId: 'x',
  lastPublishedVersion: '1',
  lastPublishedAt: 1,
  ...over,
})

/** A document carrying one attachment ref, matched by filename on import. */
const docWithRef = (title: string, filename: string): FormDocument => {
  const doc = newDocument(title)
  doc.attachments.push({ id: `ref-${filename}`, filename, mediatype: 'text/csv', size: 1, role: 'csv' })
  return doc
}

const csv = (filename: string, text: string): ArchiveAttachment => ({
  filename,
  mediatype: 'text/csv',
  blob: new Blob([text], { type: 'text/csv' }),
})

describe.each(backendCases)('publish targets repo ($name backend)', ({ setup }) => {
  beforeEach(setup)

  it('upserts a target and lists it for its form', async () => {
    const record = await targetsRepo.upsertTarget(target({ formRecordId: 'f1', serverId: 's1' }))
    expect(record.id).toBeTruthy()
    const list = await targetsRepo.listTargetsForForm('f1')
    expect(list).toHaveLength(1)
    expect(list[0].serverId).toBe('s1')
  })

  it('re-upserting the same destination updates in place (no duplicate row)', async () => {
    const first = await targetsRepo.upsertTarget(target({ formRecordId: 'f', serverId: 's', lastPublishedVersion: '1', lastPublishedAt: 10 }))
    const second = await targetsRepo.upsertTarget(target({ formRecordId: 'f', serverId: 's', lastPublishedVersion: '2', lastPublishedAt: 20 }))
    expect(second.id).toBe(first.id)
    const list = await targetsRepo.listTargetsForForm('f')
    expect(list).toHaveLength(1)
    expect(list[0].lastPublishedVersion).toBe('2')
    expect(list[0].lastPublishedAt).toBe(20)
  })

  it('records distinct targets for distinct destinations', async () => {
    await targetsRepo.upsertTarget(target({ formRecordId: 'f', serverId: 's1' }))
    await targetsRepo.upsertTarget(target({ formRecordId: 'f', serverId: 's2' }))
    await targetsRepo.upsertTarget(target({ formRecordId: 'f', serverId: 's1', projectId: 2 }))
    expect(await targetsRepo.listTargetsForForm('f')).toHaveLength(3)
  })

  it('deleting a form cascades its publish targets', async () => {
    const record = await formsRepo.createForm(newDocument('A'))
    await targetsRepo.upsertTarget(target({ formRecordId: record.id, serverId: 's' }))
    await formsRepo.deleteForm(record.id)
    expect(await targetsRepo.listTargetsForForm(record.id)).toHaveLength(0)
  })

  // replaceFormWithArchiveAttachments lives with the targets suite because its
  // defining property vs. delete-and-recreate is that it KEEPS the form's id —
  // and therefore its remembered publish targets.
  describe('replaceFormWithArchiveAttachments', () => {
    it('keeps the record id and createdAt, overwrites attachments, and spares publish targets', async () => {
      const created = await formsRepo.createFormWithArchiveAttachments(
        docWithRef('Original', 'a.csv'),
        [csv('a.csv', 'original')]
      )
      await targetsRepo.upsertTarget(target({ formRecordId: created.id, serverId: 'srv-a' }))

      const replaced = await formsRepo.replaceFormWithArchiveAttachments(
        created.id,
        docWithRef('Replaced', 'b.csv'),
        [csv('b.csv', 'replaced')]
      )

      // Same record id and no duplicate form.
      expect(replaced.id).toBe(created.id)
      expect(await formsRepo.listForms()).toHaveLength(1)

      const fetched = await formsRepo.getForm(created.id)
      expect(fetched?.title).toBe('Replaced')
      expect(fetched?.createdAt).toBe(created.createdAt)

      // Old attachment gone, new one present and readable.
      const atts = await attachmentsRepo.listAttachments(created.id)
      expect(atts.map((a) => a.filename)).toEqual(['b.csv'])
      expect(await atts[0].blob.text()).toBe('replaced')

      // The publish target survives the replace.
      const targets = await targetsRepo.listTargetsForForm(created.id)
      expect(targets).toHaveLength(1)
      expect(targets[0].serverId).toBe('srv-a')
    })

    it('rejects replacing an unknown record id', async () => {
      await expect(
        formsRepo.replaceFormWithArchiveAttachments('missing', newDocument('X'), [])
      ).rejects.toThrow()
    })
  })
})
