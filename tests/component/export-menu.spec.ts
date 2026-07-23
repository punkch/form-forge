import type { VueWrapper } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ExportMenu from '@/components/importexport/ExportMenu.vue'
import { createNode, newDocument } from '@/core/model/factory'
import { insertNode } from '@/core/model/ops'
import { DEFAULT_LANG } from '@/core/model/types'
import { error, warning } from '@/core/validate/issues'
import { useEmbedStore } from '@/stores/embed'
import { useFormStore } from '@/stores/form'
import { useUiStore } from '@/stores/ui'

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
    expect(labels).toContain('XForm XML')
    expect(labels).toContain('XLSForm (.xlsx)')
    expect(labels).toContain('ZIP · XForm XML + attachments')
    expect(labels).toContain('ZIP · XLSForm + attachments')
  })

  // aria-level is not an allowed attribute on role="menuitem" (axe
  // aria-allowed-attr); TieredMenu hardcodes it internally. See the code
  // comment on the SplitButton's `pt` prop in ExportMenu.vue for the outcome.
  it('does not emit aria-level on menuitem elements', async () => {
    const wrapper = await openMenu()
    const menuitems = wrapper.findAll('[role="menuitem"]')
    expect(menuitems.length).toBeGreaterThan(0)
    for (const item of menuitems) {
      expect(item.attributes('aria-level')).toBeUndefined()
    }
  })
})

describe('ExportMenu format memory', () => {
  let pinia: Pinia

  beforeEach(() => {
    // The ui store persists lastExportFormat to localStorage; isolate tests.
    localStorage.clear()
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    form.recordId = 'rec1'
  })

  const openMenu = async (): Promise<VueWrapper> => {
    const wrapper = mountWith(pinia, ExportMenu, {
      global: { stubs: { teleport: true } },
    })
    await wrapper.find('button[aria-haspopup="true"]').trigger('click')
    await vi.waitUntil(() => wrapper.find('[role="menuitem"]').exists())
    return wrapper
  }

  it('shows the remembered format on the primary button', async () => {
    useUiStore().setLastExportFormat('rec1', 'xlsform')
    const wrapper = mountWith(pinia, ExportMenu)
    expect(wrapper.get('[data-testid="export-button"]').text()).toContain('Export · XLSForm')
  })

  it('defaults the primary to XForm when there is no memory', async () => {
    const wrapper = mountWith(pinia, ExportMenu)
    expect(wrapper.get('[data-testid="export-button"]').text()).toContain('Export · XForm')
  })

  it('picking a format from the dropdown remembers it and promotes the primary', async () => {
    const wrapper = await openMenu()
    const item = wrapper.findAll('[role="menuitem"]').find((i) => i.text() === 'XLSForm (.xlsx)')
    await item!.find('a').trigger('click')

    expect(useUiStore().getLastExportFormat('rec1')).toBe('xlsform')
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="export-button"]').text()).toContain('Export · XLSForm')
  })

  it('marks the active format in the dropdown with a check icon', async () => {
    useUiStore().setLastExportFormat('rec1', 'xlsform')
    const wrapper = await openMenu()
    const active = wrapper.find('.export-format-active')
    expect(active.exists()).toBe(true)
    expect(active.text()).toContain('XLSForm (.xlsx)')
    expect(active.find('.pi-check').exists()).toBe(true)
  })

  it('does not write memory on a primary click — only dropdown picks remember', async () => {
    const wrapper = mountWith(pinia, ExportMenu)
    await wrapper.get('[data-testid="export-button"] button').trigger('click')
    expect(useUiStore().getLastExportFormat('rec1')).toBeNull()
  })

  it('retriggers the label crossfade class on a same-form format change and clears it on animationend', async () => {
    const wrapper = await openMenu()
    const item = wrapper.findAll('[role="menuitem"]').find((i) => i.text() === 'XLSForm (.xlsx)')
    await item!.find('a').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const root = wrapper.get('[data-testid="export-button"]')
    expect(root.classes()).toContain('ff-export-label-changed')
    await root.trigger('animationend')
    expect(root.classes()).not.toContain('ff-export-label-changed')
  })

  it('does not flash the label when switching to a form with a different remembered format', async () => {
    useUiStore().setLastExportFormat('rec2', 'xlsform')
    const wrapper = mountWith(pinia, ExportMenu)

    const form = useFormStore()
    form.recordId = 'rec2'
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const root = wrapper.get('[data-testid="export-button"]')
    expect(root.text()).toContain('Export · XLSForm')
    expect(root.classes()).not.toContain('ff-export-label-changed')
  })

  it('falls back to the first enabled action when the embed host disabled the remembered format', async () => {
    useUiStore().setLastExportFormat('rec1', 'xlsform')
    const embed = useEmbedStore()
    embed.active = true
    embed.config = { exports: { xlsform: false } }

    const wrapper = mountWith(pinia, ExportMenu)
    expect(wrapper.get('[data-testid="export-button"]').text()).toContain('Export · XForm')
  })
})
