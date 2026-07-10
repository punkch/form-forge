import { flushPromises, type DOMWrapper, type VueWrapper } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import Select from 'primevue/select'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import TypeConfigSection from '@/components/properties/TypeConfigSection.vue'
import { newDocument } from '@/core/model/factory'
import type { QuestionNode } from '@/core/model/types'
import type { AttachmentRecord } from '@/persistence/db'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

// Blob-backed columns flow through the attachments repo; mock it so the
// store's dataset refresher parses in-memory content.
const repo = vi.hoisted(() => ({
  addAttachment: vi.fn(),
  deleteAttachment: vi.fn(async (): Promise<void> => {}),
  getAttachment: vi.fn(async (): Promise<AttachmentRecord | undefined> => undefined),
  listAttachments: vi.fn(async () => []),
  pruneOrphans: vi.fn(async (): Promise<void> => {}),
}))
vi.mock('@/persistence/attachments-repo', () => repo)

/** Waits out the store's dataset-refresh debounce (250ms) plus parsing. */
const settleColumns = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 400))
  await flushPromises()
}

describe('TypeConfigSection — column-aware parameters', () => {
  let pinia: Pinia

  beforeEach(() => {
    localStorage.clear()
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    form.recordId = 'r1'
    repo.getAttachment.mockReset()
  })

  const addFromFileNode = (filename: string): QuestionNode => {
    const form = useFormStore()
    const id = form.addNode('select_one_from_file', null) as string
    form.updateNode(id, 'set file', (n) => {
      if (n.kind === 'question') n.itemsetFile = filename
    })
    return form.getNode(id) as QuestionNode
  }

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

  const paramField = (wrapper: VueWrapper, name: string): DOMWrapper<HTMLElement> =>
    wrapper.find<HTMLElement>(`[data-testid="prop-param-${name}"]`)

  it('falls back to a free-text input while columns are unknown', () => {
    const node = addFromFileNode('villages.csv')
    const wrapper = mountWith(pinia, TypeConfigSection, { props: { node } })

    expect(paramField(wrapper, 'value').element.tagName).toBe('INPUT')
    expect(paramField(wrapper, 'value').classes()).toContain('p-inputtext')
    expect(wrapper.find('[data-testid="prop-itemset-view"]').exists()).toBe(false)
  })

  it('placeholders the value/label params with the geojson defaults (id/title)', () => {
    // No attachment parsed → free-text inputs whose placeholder is the
    // per-format ODK default. GeoJSON defaults to id/title (not name/label).
    const node = addFromFileNode('sites.geojson')
    const wrapper = mountWith(pinia, TypeConfigSection, { props: { node } })

    expect((paramField(wrapper, 'value').element as HTMLInputElement).placeholder).toBe('id')
    expect((paramField(wrapper, 'label').element as HTMLInputElement).placeholder).toBe('title')
  })

  it('upgrades value/label params to editable selects once columns are parsed', async () => {
    const node = addFromFileNode('villages.csv')
    attachCsv('villages.csv', 'name,label,district\nv1,V1,d1\n')
    const wrapper = mountWith(pinia, TypeConfigSection, { props: { node } })
    await settleColumns()

    const form = useFormStore()
    expect(form.datasetColumnsByFilename.get('villages.csv')).toEqual(['name', 'label', 'district'])

    const valueSelect = wrapper.getComponent<typeof Select>('[data-testid="prop-param-value"]')
    expect(valueSelect.classes()).toContain('p-select')
    expect(valueSelect.props('options')).toEqual(['name', 'label', 'district'])
    expect(valueSelect.props('editable')).toBe(true)
    const labelSelect = wrapper.getComponent<typeof Select>('[data-testid="prop-param-label"]')
    expect(labelSelect.props('options')).toEqual(['name', 'label', 'district'])

    // Non-column params (e.g. seed) stay free text.
    expect(paramField(wrapper, 'seed').element.tagName).toBe('INPUT')

    // Picking an option writes the parameter through the form store.
    valueSelect.vm.$emit('update:modelValue', 'district')
    expect((form.getNode(node.id) as QuestionNode).body.parameters?.value).toBe('district')
  })

  it('shows a view-file button for attached files that opens the preview dialog', async () => {
    const node = addFromFileNode('villages.csv')
    attachCsv('villages.csv', 'name,label\nv1,V1\n')
    const wrapper = mountWith(pinia, TypeConfigSection, { props: { node } })
    await settleColumns()

    const view = wrapper.find('[data-testid="prop-itemset-view"]')
    expect(view.exists()).toBe(true)
    await view.trigger('click')

    const editor = useEditorStore()
    expect(editor.activeDialog).toBe('dataset-preview')
    expect(editor.datasetPreviewFilename).toBe('villages.csv')
  })
})
