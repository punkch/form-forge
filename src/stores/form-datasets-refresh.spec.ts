import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { newDocument } from '@/core/model/factory'
import type { AttachmentRecord } from '@/persistence/db'

import { useFormStore } from './form'

// Mock the attachments repo so we control what getAttachment returns/throws
// without touching IndexedDB. recordId stays null so autosave short-circuits.
const repo = vi.hoisted(() => ({
  addAttachment: vi.fn(),
  deleteAttachment: vi.fn(async (): Promise<void> => {}),
  getAttachment: vi.fn(async (): Promise<AttachmentRecord | undefined> => undefined),
  listAttachments: vi.fn(async () => []),
  pruneOrphans: vi.fn(async (): Promise<void> => {}),
}))
vi.mock('@/persistence/attachments-repo', () => repo)

/** Waits out the store's dataset-refresh debounce (250ms) plus async parsing. */
const settle = async (ms = 500): Promise<void> =>
  await new Promise((resolve) => setTimeout(resolve, ms))

describe('form store — dataset refresher error and deletion paths', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    repo.getAttachment.mockReset()
  })

  const attachCsvRef = (store: ReturnType<typeof useFormStore>, filename: string, id: string): void => {
    store.mutate('attach', (d) => {
      d.attachments.push({ id, filename, mediatype: 'text/csv', size: 1, role: 'csv' })
    })
  }

  it('records null columns when reading the attachment blob rejects', async () => {
    const store = useFormStore()
    store.doc = newDocument('T')
    repo.getAttachment.mockRejectedValue(new Error('blob read failed'))

    attachCsvRef(store, 'villages.csv', 'rec-1')
    await settle()

    // The try/catch around the read maps the failure to null (unknown columns).
    expect(store.datasetColumnsByFilename.get('villages.csv')).toBeNull()
  })

  it('drops the columns entry once its attachment is removed', async () => {
    const store = useFormStore()
    store.doc = newDocument('T')
    const record: AttachmentRecord = {
      id: 'rec-1',
      formRecordId: 'r1',
      filename: 'villages.csv',
      mediatype: 'text/csv',
      size: 18,
      blob: new Blob(['name,label\nv1,V1\n'], { type: 'text/csv' }),
    }
    repo.getAttachment.mockResolvedValue(record)

    attachCsvRef(store, 'villages.csv', 'rec-1')
    await settle()
    expect(store.datasetColumnsByFilename.get('villages.csv')).toEqual(['name', 'label'])

    // Removing the attachment ref drops it from the derived filename map.
    store.mutate('detach', (d) => { d.attachments = [] })
    await settle()
    expect(store.datasetColumnsByFilename.has('villages.csv')).toBe(false)
  })
})
