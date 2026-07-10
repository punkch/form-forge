import { flushPromises, type VueWrapper } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import DatasetPreviewDialog from '@/components/datasets/DatasetPreviewDialog.vue'
import { newDocument } from '@/core/model/factory'
import type { AttachmentRecord } from '@/persistence/db'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

// Blobs flow through the attachments repo; mock it so the dialog reads
// in-memory content instead of IndexedDB.
const repo = vi.hoisted(() => ({
  addAttachment: vi.fn(),
  deleteAttachment: vi.fn(async (): Promise<void> => {}),
  getAttachment: vi.fn(async (): Promise<AttachmentRecord | undefined> => undefined),
  listAttachments: vi.fn(async () => []),
  pruneOrphans: vi.fn(async (): Promise<void> => {}),
}))
vi.mock('@/persistence/attachments-repo', () => repo)

const mountDialog = (pinia: Pinia): VueWrapper =>
  mountWith(pinia, DatasetPreviewDialog, { global: { stubs: { teleport: true } } })

const findTestId = (wrapper: VueWrapper, id: string): ReturnType<VueWrapper['find']> =>
  wrapper.find(`[data-testid="${id}"]`)

describe('DatasetPreviewDialog', () => {
  let pinia: Pinia

  beforeEach(() => {
    localStorage.clear()
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    form.recordId = 'r1'
    repo.getAttachment.mockReset()
  })

  const attachCsv = (filename: string, content: string): void => {
    const form = useFormStore()
    const record: AttachmentRecord = {
      id: `rec-${filename}`,
      formRecordId: 'r1',
      filename,
      mediatype: 'text/csv',
      size: content.length,
      blob: new Blob([content], { type: 'text/csv' }),
    }
    repo.getAttachment.mockResolvedValue(record)
    form.mutate('attach', (d) => {
      d.attachments.push({ id: record.id, filename, mediatype: record.mediatype, size: record.size, role: 'csv' })
    })
  }

  it('shows the missing-file note when the referenced attachment is gone', async () => {
    const wrapper = mountDialog(pinia)
    // Open a preview for a filename the form never attached → missing state.
    useEditorStore().openDatasetPreview('ghost.csv')

    await vi.waitUntil(() => findTestId(wrapper, 'dataset-preview-missing').exists())
    expect(findTestId(wrapper, 'dataset-preview-table').exists()).toBe(false)
  })

  it('shows the empty-file note for a CSV with no rows', async () => {
    attachCsv('empty.csv', '')
    const wrapper = mountDialog(pinia)
    useEditorStore().openDatasetPreview('empty.csv')

    await vi.waitUntil(() => wrapper.text().includes('The file has no rows'))
    await flushPromises()
    // The empty note renders, and no data table is built.
    expect(findTestId(wrapper, 'dataset-preview-table').exists()).toBe(false)
  })
})
