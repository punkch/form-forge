import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAttachmentUpload } from '@/composables/useAttachmentUpload'
import { newDocument } from '@/core/model/factory'
import type { AttachmentRole } from '@/core/model/types'
import { useFormStore } from '@/stores/form'

import { freshPinia } from './helpers'

// Mock the repo: no IndexedDB blobs, and addAttachment calls can be asserted /
// forced to reject. roleFor is internal to the composable, so it is covered
// here through attachFile's resulting document refs.
const repo = vi.hoisted(() => ({
  addAttachment: vi.fn(),
  deleteAttachment: vi.fn(async (): Promise<void> => {}),
  getAttachment: vi.fn(async () => undefined),
  listAttachments: vi.fn(async () => []),
  pruneOrphans: vi.fn(async (): Promise<void> => {}),
}))
vi.mock('@/persistence/attachments-repo', () => repo)

describe('useAttachmentUpload.attachFile', () => {
  beforeEach(() => {
    freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    form.recordId = 'r1'
    repo.addAttachment.mockReset()
    repo.deleteAttachment.mockClear()
    repo.addAttachment.mockImplementation(
      async (formRecordId: string, filename: string, blob: Blob) => ({
        id: `rec-${filename}`,
        formRecordId,
        filename,
        mediatype: blob.type || 'application/octet-stream',
        size: blob.size,
        blob,
      })
    )
  })

  const roleOfUpload = async (filename: string, mediatype: string): Promise<AttachmentRole | undefined> => {
    const form = useFormStore()
    // Fresh doc per classification: keeps each upload independent (and avoids
    // accumulating reactive refs that happy-dom's structuredClone trips on).
    form.doc = newDocument('T')
    const { attachFile } = useAttachmentUpload()
    await attachFile(new File(['x'], filename, { type: mediatype }))
    return form.doc?.attachments.find((a) => a.filename === filename)?.role
  }

  it('classifies roles from extension then mimetype', async () => {
    expect(await roleOfUpload('data.csv', 'text/csv')).toBe('csv')
    expect(await roleOfUpload('shape.geojson', 'application/geo+json')).toBe('geojson')
    expect(await roleOfUpload('ext.xml', 'text/xml')).toBe('xml')
    expect(await roleOfUpload('photo.png', 'image/png')).toBe('media')
    expect(await roleOfUpload('clip.mp3', 'audio/mpeg')).toBe('media')
    expect(await roleOfUpload('doc.pdf', 'application/pdf')).toBe('other')
  })

  it('returns null and stores nothing when no form is open', async () => {
    const form = useFormStore()
    form.recordId = null
    const { attachFile } = useAttachmentUpload()

    const result = await attachFile(new File(['x'], 'data.csv', { type: 'text/csv' }))

    expect(result).toBeNull()
    expect(repo.addAttachment).not.toHaveBeenCalled()
    expect(form.doc?.attachments).toEqual([])
  })

  it('propagates a repo rejection and leaves the document untouched', async () => {
    const form = useFormStore()
    repo.addAttachment.mockRejectedValueOnce(new Error('disk full'))
    const { attachFile } = useAttachmentUpload()

    await expect(attachFile(new File(['x'], 'data.csv', { type: 'text/csv' }))).rejects.toThrow('disk full')
    expect(form.doc?.attachments).toEqual([])
  })
})
