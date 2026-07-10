import type { VueWrapper } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ExportMenu from '@/components/importexport/ExportMenu.vue'
import { createNode, newDocument } from '@/core/model/factory'
import { insertNode } from '@/core/model/ops'
import { DEFAULT_LANG } from '@/core/model/types'
import { error, warning } from '@/core/validate/issues'
import { useFormStore } from '@/stores/form'

import { freshPinia, mountWith } from './helpers'

const toast = { add: vi.fn() }
vi.mock('primevue/usetoast', () => ({ useToast: () => toast }))

describe('ExportMenu readiness summary', () => {
  let pinia: Pinia

  beforeEach(() => {
    pinia = freshPinia()
    const form = useFormStore()
    // Built outside store mutations so no debounced re-validation can
    // overwrite the manually seeded issues below.
    form.doc = newDocument('T')
  })

  const openMenu = async (): Promise<VueWrapper> => {
    const wrapper = mountWith(pinia, ExportMenu, {
      global: { stubs: { teleport: true } },
    })
    await wrapper.find('button[aria-haspopup="true"]').trigger('click')
    await vi.waitUntil(() => wrapper.find('[role="menuitem"]').exists())
    return wrapper
  }

  // The summary line is the single disabled menu entry at the top.
  const summaryItem = (wrapper: VueWrapper) =>
    wrapper.find('[role="menuitem"].p-disabled')

  it('shows how many problems block export when errors exist', async () => {
    const form = useFormStore()
    form.issues = [
      error('a.code', 'Broken', {}),
      error('b.code', 'Also broken', {}),
      warning('c.code', 'Sketchy', {}),
    ]

    const wrapper = await openMenu()
    expect(summaryItem(wrapper).text()).toBe('2 problems block export')
  })

  it('uses the singular form for one blocking problem', async () => {
    const form = useFormStore()
    form.issues = [error('a.code', 'Broken', {})]

    const wrapper = await openMenu()
    expect(summaryItem(wrapper).text()).toBe('1 problem blocks export')
  })

  it('shows Ready with the warning count when there are no errors', async () => {
    const form = useFormStore()
    form.issues = [warning('c.code', 'Sketchy', {})]

    const wrapper = await openMenu()
    expect(summaryItem(wrapper).text()).toBe('Ready · 1 warning')
  })

  it('pluralizes multiple warnings', async () => {
    const form = useFormStore()
    form.issues = [warning('c.code', 'Sketchy', {}), warning('d.code', 'Iffy', {})]

    const wrapper = await openMenu()
    expect(summaryItem(wrapper).text()).toBe('Ready · 2 warnings')
  })

  it('shows Ready · no warnings for a clean form', async () => {
    const wrapper = await openMenu()
    expect(summaryItem(wrapper).text()).toBe('Ready · no warnings')
  })

  it('appends the untranslated cell count when languages are declared', async () => {
    const form = useFormStore()
    const doc = form.doc!
    const node = createNode(doc, 'text')
    node.label = { [DEFAULT_LANG]: 'Hello' }
    insertNode(doc, node, null)
    doc.languages.push('French (fr)')

    const wrapper = await openMenu()
    expect(summaryItem(wrapper).text()).toBe('Ready · no warnings · 1 untranslated')
  })

  it('ignores sites that are empty in every language (empty rows are not untranslated)', async () => {
    const form = useFormStore()
    const doc = form.doc!
    const node = createNode(doc, 'text')
    node.label = { [DEFAULT_LANG]: 'Hello', 'French (fr)': 'Bonjour' }
    // A constraint with no message adds an (empty) constraint-message site to
    // the grid; hint/guidance-hint sites are always present. None of these
    // carry text in any language, so none may count as untranslated.
    node.bind.constraint = '. != 1'
    insertNode(doc, node, null)
    doc.languages.push('French (fr)')

    const wrapper = await openMenu()
    expect(summaryItem(wrapper).text()).toBe('Ready · no warnings')
  })

  it('omits the untranslated segment when every declared language is complete', async () => {
    const form = useFormStore()
    const doc = form.doc!
    const node = createNode(doc, 'text')
    node.label = { [DEFAULT_LANG]: 'Hello', 'French (fr)': 'Bonjour' }
    insertNode(doc, node, null)
    doc.languages.push('French (fr)')

    const wrapper = await openMenu()
    expect(summaryItem(wrapper).text()).toBe('Ready · no warnings')
  })

  it('keeps the export actions after the summary line', async () => {
    const wrapper = await openMenu()
    const labels = wrapper.findAll('[role="menuitem"]').map((item) => item.text())
    expect(labels).toContain('XLSForm (.xlsx)')
    expect(labels).toContain('ZIP with attachments')
  })
})
