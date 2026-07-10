import { beforeEach, describe, expect, it } from 'vitest'

import { createNode, newDocument } from '@/core/model/factory'
import { insertNode } from '@/core/model/ops'

import { backendCases } from '../../tests/helpers/backends'
import { getPersistenceBackend } from './backend'
import * as attachmentsRepo from './attachments-repo'
import * as formsRepo from './forms-repo'

// Contract suite: the repos must behave identically on the Dexie default and
// on embed mode's memory backend (tests/helpers/backends.ts).
describe.each(backendCases)('forms repo ($name backend)', ({ setup }) => {
  beforeEach(setup)

  const snapshotCount = async (formRecordId: string): Promise<number> =>
    (await getPersistenceBackend().listSnapshots(formRecordId)).length

  describe('forms repo', () => {
    it('creates, gets, lists and saves forms', async () => {
      const doc = newDocument('Household Survey')
      const record = await formsRepo.createForm(doc)
      expect(record.title).toBe('Household Survey')
      expect(record.formId).toBe('household_survey')

      const fetched = await formsRepo.getForm(record.id)
      expect(fetched?.doc.settings.formTitle).toBe('Household Survey')

      insertNode(fetched!.doc, createNode(fetched!.doc, 'text'), null)
      await formsRepo.saveForm(record.id, fetched!.doc)

      const listed = await formsRepo.listForms()
      expect(listed).toHaveLength(1)
      expect(listed[0].questionCount).toBe(1)
    })

    it('save keeps createdAt and refuses unknown records', async () => {
      const record = await formsRepo.createForm(newDocument('A'))
      await formsRepo.saveForm(record.id, record.doc)
      const fetched = await formsRepo.getForm(record.id)
      expect(fetched?.createdAt).toBe(record.createdAt)
      await expect(formsRepo.saveForm('missing', record.doc)).rejects.toThrow()
    })

    it('deleteForm removes attachments and snapshots too', async () => {
      const record = await formsRepo.createForm(newDocument('A'))
      await attachmentsRepo.addAttachment(record.id, 'logo.png', new Blob(['x'], { type: 'image/png' }))
      await formsRepo.addSnapshot(record.id, record.doc, 'manual')
      await formsRepo.deleteForm(record.id)
      expect(await formsRepo.listForms()).toHaveLength(0)
      expect(await attachmentsRepo.listAttachments(record.id)).toHaveLength(0)
      expect(await snapshotCount(record.id)).toBe(0)
    })

    it('duplicateForm copies the doc and its attachments with new ids', async () => {
      const doc = newDocument('Original')
      const record = await formsRepo.createForm(doc)
      const att = await attachmentsRepo.addAttachment(record.id, 'list.csv', new Blob(['a,b'], { type: 'text/csv' }))
      const original = await formsRepo.getForm(record.id)
      original!.doc.attachments.push({
        id: att.id, filename: att.filename, mediatype: att.mediatype, size: att.size, role: 'csv',
      })
      await formsRepo.saveForm(record.id, original!.doc)

      const copy = await formsRepo.duplicateForm(record.id)
      expect(copy?.title).toBe('Original (copy)')
      const copyAttachments = await attachmentsRepo.listAttachments(copy!.id)
      expect(copyAttachments).toHaveLength(1)
      expect(copyAttachments[0].id).not.toBe(att.id)
      const savedCopy = await formsRepo.getForm(copy!.id)
      expect(savedCopy?.doc.attachments[0].id).toBe(copyAttachments[0].id)
    })

    it('prunes snapshots beyond the per-form cap', async () => {
      const record = await formsRepo.createForm(newDocument('A'))
      for (let i = 0; i < 25; i++) {
        await formsRepo.addSnapshot(record.id, record.doc, 'auto')
      }
      expect(await snapshotCount(record.id)).toBeLessThanOrEqual(20)
    })

    it('stored records never alias caller-held objects', async () => {
      const record = await formsRepo.createForm(newDocument('Aliasing'))
      // Mutating the returned record must not leak into storage.
      record.doc.settings.formTitle = 'Mutated after create'
      const fetched = await formsRepo.getForm(record.id)
      expect(fetched?.doc.settings.formTitle).toBe('Aliasing')
      // Mutating a fetched record must not leak into storage either.
      fetched!.doc.settings.formTitle = 'Mutated after get'
      const refetched = await formsRepo.getForm(record.id)
      expect(refetched?.doc.settings.formTitle).toBe('Aliasing')
    })
  })

  describe('attachments repo', () => {
    it('stores and prunes orphan blobs', async () => {
      const record = await formsRepo.createForm(newDocument('A'))
      const keep = await attachmentsRepo.addAttachment(record.id, 'keep.csv', new Blob(['k']))
      await attachmentsRepo.addAttachment(record.id, 'orphan.csv', new Blob(['o']))
      await attachmentsRepo.pruneOrphans(record.id, new Set([keep.id]))
      const remaining = await attachmentsRepo.listAttachments(record.id)
      expect(remaining.map((a) => a.filename)).toEqual(['keep.csv'])
    })

    it('getAttachment returns the stored record with its blob', async () => {
      const record = await formsRepo.createForm(newDocument('A'))
      const att = await attachmentsRepo.addAttachment(record.id, 'list.csv', new Blob(['a,b'], { type: 'text/csv' }))
      const fetched = await attachmentsRepo.getAttachment(att.id)
      expect(fetched?.filename).toBe('list.csv')
      expect(await fetched!.blob.text()).toBe('a,b')
      expect(await attachmentsRepo.getAttachment('missing')).toBeUndefined()
    })
  })
})
