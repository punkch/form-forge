import type { VueWrapper } from '@vue/test-utils'
import type { Pinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resetClipboardBufferForTests, writeClipboardBuffer } from '@/clipboard/buffer'
import CanvasToolbar from '@/components/canvas/CanvasToolbar.vue'
import { CLIPBOARD_KIND, CLIPBOARD_VERSION, type NodesPayload } from '@/core/clipboard/payload'
import { newDocument } from '@/core/model/factory'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { q } from '../helpers/doc-builders'
import { freshPinia, mountWith } from './helpers'

const toast = { add: vi.fn() }
vi.mock('primevue/usetoast', () => ({ useToast: () => toast }))

// A minimal clipboard payload for paste-enabled tests — bypasses
// buildNodesPayload, same shortcut as use-selection-actions.spec.ts.
const makePayload = (): NodesPayload => ({
  kind: CLIPBOARD_KIND,
  version: CLIPBOARD_VERSION,
  nodes: [q('text', 'p1', 'P1')],
  choiceLists: {},
  languages: [],
  attachmentFilenames: [],
  copiedAt: Date.now(),
})

describe('CanvasToolbar', () => {
  let pinia: Pinia

  beforeEach(() => {
    localStorage.clear()
    resetClipboardBufferForTests()
    toast.add.mockReset()
    pinia = freshPinia()
    const form = useFormStore()
    form.doc = newDocument('T')
    form.recordId = 'r1'
  })

  const addNode = (): string => useFormStore().addNode('text', null) as string

  // The gear's Menu popup is a Teleport target; stubbing it keeps the popup
  // content inside the mounted wrapper's DOM so it's queryable (same
  // approach as export-menu.spec.ts, which hits the identical PrimeVue Menu
  // popup pattern).
  const mountToolbar = (): VueWrapper =>
    mountWith(pinia, CanvasToolbar, { global: { stubs: { teleport: true } } })

  describe('cut/copy/paste/delete disabled states', () => {
    it('disables cut/copy/delete with no selection, and paste with an empty clipboard', () => {
      const wrapper = mountToolbar()

      expect((wrapper.get('[data-testid="toolbar-cut"]').element as HTMLButtonElement).disabled).toBe(true)
      expect((wrapper.get('[data-testid="toolbar-copy"]').element as HTMLButtonElement).disabled).toBe(true)
      expect((wrapper.get('[data-testid="toolbar-delete"]').element as HTMLButtonElement).disabled).toBe(true)
      expect((wrapper.get('[data-testid="toolbar-paste"]').element as HTMLButtonElement).disabled).toBe(true)
    })

    it('enables cut/copy/delete once a node is selected', () => {
      const editor = useEditorStore()
      const a = addNode()
      editor.select(a)
      const wrapper = mountToolbar()

      expect((wrapper.get('[data-testid="toolbar-cut"]').element as HTMLButtonElement).disabled).toBe(false)
      expect((wrapper.get('[data-testid="toolbar-copy"]').element as HTMLButtonElement).disabled).toBe(false)
      expect((wrapper.get('[data-testid="toolbar-delete"]').element as HTMLButtonElement).disabled).toBe(false)
    })

    it('enables paste once the clipboard buffer holds a payload', () => {
      writeClipboardBuffer(makePayload())
      const wrapper = mountToolbar()

      expect((wrapper.get('[data-testid="toolbar-paste"]').element as HTMLButtonElement).disabled).toBe(false)
    })

    it('clicking cut/copy/delete calls through to the selection actions', async () => {
      const editor = useEditorStore()
      const form = useFormStore()
      const a = addNode()
      const b = addNode()
      editor.select(a)
      const wrapper = mountToolbar()

      await wrapper.get('[data-testid="toolbar-delete"]').trigger('click')

      expect(form.doc?.children.map((n) => n.id)).toEqual([b])
      expect(editor.selectedNodeId).toBeNull()
    })
  })

  describe('selection chip', () => {
    it('is hidden with no selection', () => {
      const wrapper = mountToolbar()
      expect(wrapper.find('[data-testid="selection-count"]').exists()).toBe(false)
    })

    it('stays hidden for a single selection — the card highlight already says selected', () => {
      const editor = useEditorStore()
      editor.select(addNode())
      const wrapper = mountToolbar()

      expect(wrapper.find('[data-testid="selection-count"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="selection-clear"]').exists()).toBe(false)
    })

    it('shows the count and a clear button for a multi-selection, which clears the selection on click', async () => {
      const editor = useEditorStore()
      const a = addNode()
      const b = addNode()
      editor.selectMany([a, b])
      const wrapper = mountToolbar()

      const chip = wrapper.get('[data-testid="selection-count"]')
      expect(chip.text()).toContain('2 selected')
      const clear = wrapper.get('[data-testid="selection-clear"]')

      await clear.trigger('click')

      expect(editor.selectedNodeIds.size).toBe(0)
      expect(wrapper.find('[data-testid="selection-count"]').exists()).toBe(false)
    })
  })

  describe('undo/redo', () => {
    it('renders UndoRedoButtons at the start of the toolbar', () => {
      const wrapper = mountToolbar()
      expect(wrapper.find('[data-testid="undo"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="redo"]').exists()).toBe(true)
    })
  })

  describe('gear menu', () => {
    const openGearMenu = async (wrapper: VueWrapper): Promise<void> => {
      await wrapper.get('[data-testid="form-menu"]').trigger('click')
      await vi.waitUntil(() => wrapper.find('li[role="menuitem"]').exists())
    }

    it('has five items and one separator', async () => {
      const wrapper = mountToolbar()
      await openGearMenu(wrapper)

      expect(wrapper.findAll('li[role="menuitem"]')).toHaveLength(5)
      expect(wrapper.findAll('li[role="separator"]')).toHaveLength(1)
    })

    it('lists the four existing form-menu items plus Insert from template, in order', async () => {
      const wrapper = mountToolbar()
      await openGearMenu(wrapper)

      const labels = wrapper.findAll('li[role="menuitem"]').map((li) => li.text())
      expect(labels).toEqual([
        'Form settings',
        'Translations',
        'Choice lists',
        'Attachments',
        'Insert from template…',
      ])
    })

    it('opens the insert-template dialog when its item is picked', async () => {
      const editor = useEditorStore()
      const wrapper = mountToolbar()
      await openGearMenu(wrapper)

      const item = wrapper.findAll('li[role="menuitem"]').find((li) => li.text() === 'Insert from template…')
      await item!.find('a').trigger('click')

      expect(editor.activeDialog).toBe('insert-template')
    })

    it('opens the form-settings dialog when its item is picked', async () => {
      const editor = useEditorStore()
      const wrapper = mountToolbar()
      await openGearMenu(wrapper)

      const item = wrapper.findAll('li[role="menuitem"]').find((li) => li.text() === 'Form settings')
      await item!.find('a').trigger('click')

      expect(editor.activeDialog).toBe('settings')
    })
  })
})
