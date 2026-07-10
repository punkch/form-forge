import { flushPromises, type VueWrapper } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TypeConfigSection from '@/components/properties/TypeConfigSection.vue'
import { newDocument } from '@/core/model/factory'
import type { QuestionNode } from '@/core/model/types'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

// The upload path goes through the attachments repo; mock it so no IndexedDB
// blobs are involved and calls can be asserted.
const repo = vi.hoisted(() => ({
  addAttachment: vi.fn(),
  deleteAttachment: vi.fn(async (): Promise<void> => {}),
  getAttachment: vi.fn(async () => undefined),
  listAttachments: vi.fn(async () => []),
  pruneOrphans: vi.fn(async (): Promise<void> => {}),
}))
vi.mock('@/persistence/attachments-repo', () => repo)

describe('TypeConfigSection — choices-file upload', () => {
  let pinia: Pinia

  beforeEach(() => {
    localStorage.clear()
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    form.recordId = 'r1'
    repo.addAttachment.mockReset()
    repo.deleteAttachment.mockClear()
    repo.addAttachment.mockImplementation(
      async (formRecordId: string, filename: string, blob: Blob) => ({
        id: `rec-${filename}-${repo.addAttachment.mock.calls.length}`,
        formRecordId,
        filename,
        mediatype: blob.type || 'application/octet-stream',
        size: blob.size,
        blob,
      })
    )
  })

  const addNode = (type: string): QuestionNode => {
    const form = useFormStore()
    const id = form.addNode(type, null) as string
    return form.getNode(id) as QuestionNode
  }

  const pickFile = async (wrapper: VueWrapper, file: File): Promise<void> => {
    const input = wrapper.find('[data-testid="prop-itemset-upload-input"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()
  }

  const csvFile = (name: string): File =>
    new File(['name,label\napple,Apple\n'], name, { type: 'text/csv' })

  it('adopts the uploaded filename when itemsetFile is unset (single undo step)', async () => {
    const node = addNode('select_one_from_file')
    const form = useFormStore()
    const wrapper = mountWith(pinia, TypeConfigSection, { props: { node } })

    expect(wrapper.find('[data-testid="prop-itemset-status"]').attributes('data-state')).toBe('none')

    await pickFile(wrapper, csvFile('sites.csv'))

    expect(repo.addAttachment).toHaveBeenCalledWith('r1', 'sites.csv', expect.any(File))
    expect(node.itemsetFile).toBe('sites.csv')
    expect(form.doc?.attachments.map((a) => a.filename)).toEqual(['sites.csv'])
    expect(form.doc?.attachments[0].role).toBe('csv')
    expect(wrapper.find('[data-testid="prop-itemset-status"]').attributes('data-state')).toBe('attached')
    expect(wrapper.find('[data-testid="prop-itemset-renamed"]').exists()).toBe(false)

    // One mutate covered both the ref and the adopted filename. Undo swaps
    // the whole document, so re-resolve the node from the restored doc.
    form.undo()
    expect((form.getNode(node.id) as QuestionNode).itemsetFile).toBeUndefined()
    expect(form.doc?.attachments).toEqual([])
  })

  it('stores a differently named file under the expected name and says so', async () => {
    const node = addNode('select_one_from_file')
    const form = useFormStore()
    form.updateNode(node.id, 'set file', (n) => {
      if (n.kind === 'question') n.itemsetFile = 'districts.csv'
    })
    const wrapper = mountWith(pinia, TypeConfigSection, { props: { node } })
    expect(wrapper.find('[data-testid="prop-itemset-status"]').attributes('data-state')).toBe('missing')

    await pickFile(wrapper, csvFile('other.csv'))

    expect(repo.addAttachment).toHaveBeenCalledWith('r1', 'districts.csv', expect.any(File))
    expect(node.itemsetFile).toBe('districts.csv')
    expect(form.doc?.attachments.map((a) => a.filename)).toEqual(['districts.csv'])
    expect(wrapper.find('[data-testid="prop-itemset-status"]').attributes('data-state')).toBe('attached')
    const renamed = wrapper.find('[data-testid="prop-itemset-renamed"]')
    expect(renamed.exists()).toBe(true)
    expect(renamed.text()).toContain('districts.csv')
    expect(renamed.text()).toContain('other.csv')
  })

  it('replacing an attached file swaps the ref but keeps the superseded record (undo-safe)', async () => {
    const node = addNode('select_one_from_file')
    const form = useFormStore()
    form.updateNode(node.id, 'set file', (n) => {
      if (n.kind === 'question') n.itemsetFile = 'districts.csv'
    })
    form.doc?.attachments.push({
      id: 'old-1', filename: 'districts.csv', mediatype: 'text/csv', size: 5, role: 'csv',
    })
    const wrapper = mountWith(pinia, TypeConfigSection, { props: { node } })
    expect(wrapper.find('[data-testid="prop-itemset-status"]').attributes('data-state')).toBe('attached')

    await pickFile(wrapper, csvFile('districts.csv'))

    // Superseded records are NOT deleted at replace time — undo must be able to
    // restore them; orphans are pruned only when the form is closed.
    expect(repo.deleteAttachment).not.toHaveBeenCalled()
    const refs = form.doc?.attachments.filter((a) => a.filename === 'districts.csv') ?? []
    expect(refs).toHaveLength(1)
    expect(refs[0].id).not.toBe('old-1')
    expect(wrapper.find('[data-testid="prop-itemset-renamed"]').exists()).toBe(false)

    // Undoing the replace restores the original ref (its record still exists).
    form.undo()
    const restored = form.doc?.attachments.filter((a) => a.filename === 'districts.csv') ?? []
    expect(restored.map((a) => a.id)).toEqual(['old-1'])
  })

  it('csv-external reports the serializer default filename until a file is adopted', async () => {
    const node = addNode('csv-external')
    const wrapper = mountWith(pinia, TypeConfigSection, { props: { node } })

    const status = wrapper.find('[data-testid="prop-itemset-status"]')
    expect(status.attributes('data-state')).toBe('missing')
    expect(status.text()).toContain(`${node.name}.csv`)

    await pickFile(wrapper, csvFile('fuel.csv'))
    expect(node.itemsetFile).toBe('fuel.csv')
    expect(wrapper.find('[data-testid="prop-itemset-status"]').attributes('data-state')).toBe('attached')
  })
})
