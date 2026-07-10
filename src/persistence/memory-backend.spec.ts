import { describe, expect, it } from 'vitest'

import { newDocument } from '@/core/model/factory'

import type { AttachmentRecord, FormRecord, SnapshotRecord } from './db'
import { createMemoryBackend } from './memory-backend'

const formRecord = (id: string, createdAt = 1000): FormRecord => ({
  id,
  title: 'T',
  formId: 'f',
  version: '1',
  questionCount: 0,
  createdAt,
  updatedAt: createdAt,
  doc: newDocument('T'),
})

const attachmentRecord = (id: string, formRecordId = 'form-1'): AttachmentRecord => ({
  id,
  formRecordId,
  filename: 'list.csv',
  mediatype: 'text/csv',
  size: 3,
  blob: new Blob(['a,b'], { type: 'text/csv' }),
})

const snapshotRecord = (id: string): SnapshotRecord => ({
  id,
  formRecordId: 'form-1',
  createdAt: 1,
  kind: 'open',
  doc: newDocument('T'),
})

describe('memory backend requireNew guards', () => {
  it('rejects a duplicate form id on addForm', async () => {
    const backend = createMemoryBackend()
    await backend.addForm(formRecord('form-1'))
    await expect(backend.addForm(formRecord('form-1'))).rejects.toThrow(/already exists/)
  })

  it('rejects a duplicate attachment id on addAttachment and bulkAddAttachments', async () => {
    const backend = createMemoryBackend()
    await backend.addAttachment(attachmentRecord('att-1'))
    await expect(backend.addAttachment(attachmentRecord('att-1'))).rejects.toThrow(/already exists/)
    await expect(backend.bulkAddAttachments([attachmentRecord('att-1')])).rejects.toThrow(/already exists/)
  })

  it('rejects a duplicate snapshot id on addSnapshot', async () => {
    const backend = createMemoryBackend()
    await backend.addSnapshot(snapshotRecord('snap-1'))
    await expect(backend.addSnapshot(snapshotRecord('snap-1'))).rejects.toThrow(/already exists/)
  })

  it('importForm validates ids up front: a duplicate attachment aborts the whole import', async () => {
    const backend = createMemoryBackend()
    await backend.addAttachment(attachmentRecord('att-1'))
    await expect(
      backend.importForm(formRecord('form-2'), [attachmentRecord('att-1', 'form-2')])
    ).rejects.toThrow(/already exists/)
    // The form must not have been written even though its own id was fresh.
    expect(await backend.getForm('form-2')).toBeUndefined()
  })
})

describe('memory backend putForm', () => {
  it('preserves the stored createdAt and rejects an unknown id', async () => {
    const backend = createMemoryBackend()
    await backend.addForm(formRecord('form-1', 1000))
    await backend.putForm({ ...formRecord('form-1', 9999), updatedAt: 2000 })
    const stored = await backend.getForm('form-1')
    expect(stored?.createdAt).toBe(1000)
    expect(stored?.updatedAt).toBe(2000)
    await expect(backend.putForm(formRecord('missing'))).rejects.toThrow(/does not exist/)
  })
})
