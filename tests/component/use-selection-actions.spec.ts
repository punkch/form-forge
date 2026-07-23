import type { Pinia } from 'pinia'
import type { VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { hasClipboardBuffer, readClipboardBuffer, resetClipboardBufferForTests, writeClipboardBuffer } from '@/clipboard/buffer'
import { useSelectionActions, type SelectionActions } from '@/composables/useSelectionActions'
import { CLIPBOARD_KIND, CLIPBOARD_VERSION, type NodesPayload } from '@/core/clipboard/payload'
import { newDocument } from '@/core/model/factory'
import type { FormNode } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import { q } from '../helpers/doc-builders'
import { freshPinia, mountWith } from './helpers'

const toast = { add: vi.fn() }
vi.mock('primevue/usetoast', () => ({ useToast: () => toast }))

// A render-nothing host so useSelectionActions (a Vue composable — it calls
// useAppI18n/useToast/onScopeDispose internally) can be exercised directly,
// same pattern as useMediaAttachment's component spec.
const Host = defineComponent({
  setup: () => useSelectionActions(),
  render: () => null,
})

/** A hand-built clipboard payload, bypassing buildNodesPayload/copySelection
 * so tests can control exactly what a paste carries (extra languages,
 * attachment filenames, ...) without wiring a whole source document. */
const makePayload = (nodes: FormNode[], overrides: Partial<NodesPayload> = {}): NodesPayload => ({
  kind: CLIPBOARD_KIND,
  version: CLIPBOARD_VERSION,
  nodes,
  choiceLists: {},
  languages: [],
  attachmentFilenames: [],
  copiedAt: Date.now(),
  ...overrides,
})

/** Minimal fake ClipboardEvent — happy-dom's DataTransfer isn't exercised
 * anywhere else in this repo, so this is a plain object satisfying the
 * narrow surface applyToClipboardEvent/payloadFromClipboardEvent actually
 * touch (setData/getData/preventDefault), not a real DOM class. */
const fakeClipboardEvent = (initial: Record<string, string> = {}): ClipboardEvent => {
  const store: Record<string, string> = { ...initial }
  return {
    preventDefault: vi.fn(),
    clipboardData: {
      setData: (type: string, value: string) => { store[type] = value },
      getData: (type: string) => store[type] ?? '',
    },
  } as unknown as ClipboardEvent
}

describe('useSelectionActions', () => {
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

  const addNode = (type: string, parentId: string | null = null): string =>
    useFormStore().addNode(type, parentId) as string

  const mountHost = (): { wrapper: VueWrapper, vm: SelectionActions } => {
    const wrapper = mountWith(pinia, Host)
    return { wrapper, vm: wrapper.vm as unknown as SelectionActions }
  }

  describe('canCut / canCopy / canDelete / canPaste', () => {
    it('are false with no selection and no clipboard content', () => {
      const { vm } = mountHost()
      expect(vm.canCut).toBe(false)
      expect(vm.canCopy).toBe(false)
      expect(vm.canDelete).toBe(false)
      expect(vm.canPaste).toBe(false)
    })

    it('canCut/canCopy/canDelete follow the selection', () => {
      const editor = useEditorStore()
      const a = addNode('text')
      const { vm } = mountHost()

      editor.select(a)

      expect(vm.canCut).toBe(true)
      expect(vm.canCopy).toBe(true)
      expect(vm.canDelete).toBe(true)
    })

    it('canPaste reacts to a clipboard write without remounting', () => {
      const editor = useEditorStore()
      const a = addNode('text')
      editor.select(a)
      const { vm } = mountHost()
      expect(vm.canPaste).toBe(false)

      vm.copySelection()

      expect(vm.canPaste).toBe(true)
    })

    it('canPaste is false once no document is open, even with clipboard content', () => {
      const editor = useEditorStore()
      const form = useFormStore()
      const a = addNode('text')
      editor.select(a)
      const { vm } = mountHost()
      vm.copySelection()
      expect(vm.canPaste).toBe(true)

      form.doc = null

      expect(vm.canPaste).toBe(false)
    })

    it('unsubscribes from clipboard-buffer changes on scope dispose', () => {
      const { wrapper, vm } = mountHost()
      expect(vm.canPaste).toBe(false)

      wrapper.unmount()
      writeClipboardBuffer(makePayload([q('text', 'x', 'X')]))

      // No assertion possible on the disposed vm directly; the real proof is
      // that writing after unmount doesn't throw (a leaked listener touching
      // a torn-down scope would be the failure mode here).
      expect(hasClipboardBuffer()).toBe(true)
    })
  })

  describe('copySelection / cutSelection', () => {
    it('copySelection buffers the selection and leaves the document untouched', () => {
      const editor = useEditorStore()
      const form = useFormStore()
      const a = addNode('text')
      const b = addNode('text')
      editor.selectMany([a, b])
      const { vm } = mountHost()

      vm.copySelection()

      expect(form.doc?.children).toHaveLength(2)
      const buffered = readClipboardBuffer<NodesPayload>()
      expect(buffered?.nodes.map((n) => n.id)).toEqual([a, b])
    })

    it('cutSelection removes the selection and buffers it', () => {
      const editor = useEditorStore()
      const form = useFormStore()
      const a = addNode('text')
      const b = addNode('text')
      editor.selectMany([a])
      const { vm } = mountHost()

      vm.cutSelection()

      expect(form.doc?.children.map((n) => n.id)).toEqual([b])
      const buffered = readClipboardBuffer<NodesPayload>()
      expect(buffered?.nodes.map((n) => n.id)).toEqual([a])
    })
  })

  describe('deleteSelection', () => {
    it('removes the selection and clears it afterward', () => {
      const editor = useEditorStore()
      const form = useFormStore()
      const a = addNode('text')
      const b = addNode('text')
      editor.selectMany([a])
      const { vm } = mountHost()

      vm.deleteSelection()

      expect(form.doc?.children.map((n) => n.id)).toEqual([b])
      expect(editor.selectedNodeId).toBeNull()
      expect(editor.selectedNodeIds.size).toBe(0)
    })
  })

  describe('pasteClipboard target resolution', () => {
    it('pastes into a selected OPEN container, at its end', () => {
      const editor = useEditorStore()
      const form = useFormStore()
      const groupId = addNode('group')
      addNode('text', groupId) // one existing child
      editor.select(groupId)
      writeClipboardBuffer(makePayload([q('text', 'p1', 'P1')]))
      const { vm } = mountHost()

      vm.pasteClipboard()

      const group = form.getNode(groupId)
      const childIds = group !== null && 'children' in group ? group.children.map((n) => n.id) : []
      expect(childIds).toHaveLength(2)
      expect(editor.selectedNodeIds).toEqual(new Set([childIds[1]]))
      expect(editor.revealNodeId).toBe(childIds[1])
    })

    it('pastes at the end of the form when the selected container is COLLAPSED, not inside it', () => {
      const editor = useEditorStore()
      const form = useFormStore()
      const groupId = addNode('group')
      addNode('text', groupId)
      editor.select(groupId)
      editor.toggleExpanded(groupId) // collapse it
      writeClipboardBuffer(makePayload([q('text', 'p1', 'P1')]))
      const { vm } = mountHost()

      vm.pasteClipboard()

      const group = form.getNode(groupId)
      const childIds = group !== null && 'children' in group ? group.children.map((n) => n.id) : []
      expect(childIds).toHaveLength(1) // unchanged — pasted at root instead
      expect(form.doc?.children.at(-1)?.id).not.toBe(groupId)
    })

    it('pastes right after a selected non-container node, in its own parent', () => {
      const editor = useEditorStore()
      const form = useFormStore()
      const a = addNode('text')
      const b = addNode('text')
      editor.select(a)
      writeClipboardBuffer(makePayload([q('text', 'p1', 'P1')]))
      const { vm } = mountHost()

      vm.pasteClipboard()

      const ids = form.doc?.children.map((n) => n.id) ?? []
      expect(ids).toHaveLength(3)
      expect(ids[0]).toBe(a)
      expect(ids[2]).toBe(b)
    })

    it('pastes at the end of the form when nothing is selected', () => {
      const editor = useEditorStore()
      const form = useFormStore()
      addNode('text')
      editor.select(null)
      writeClipboardBuffer(makePayload([q('text', 'p1', 'P1')]))
      const { vm } = mountHost()

      vm.pasteClipboard()

      expect(form.doc?.children).toHaveLength(2)
    })

    it('is a no-op when the buffer is empty', () => {
      const form = useFormStore()
      addNode('text')
      const { vm } = mountHost()

      vm.pasteClipboard()

      expect(form.doc?.children).toHaveLength(1)
    })
  })

  describe('paste toast', () => {
    it('shows an informational toast for dropped languages / carried-over filenames / stripped save_to', () => {
      // English is the payload's primary — it falls back to the target's
      // primary (DEFAULT_LANG) rather than dropping; German is a
      // non-primary language unmatched by the target AND actually carried
      // by the copied node's label, so IT drops (a declared-but-unused
      // language would not be reported).
      writeClipboardBuffer(makePayload([
        q('text', 'p1', undefined, { label: { 'English (en)': 'P1', 'German (de)': 'P1 de' } }),
      ], {
        languages: ['English (en)', 'German (de)'],
        defaultLanguage: 'English (en)',
        attachmentFilenames: ['photo.png'],
      }))
      const { vm } = mountHost()

      vm.pasteClipboard()

      expect(toast.add).toHaveBeenCalledTimes(1)
      const call = toast.add.mock.calls[0][0]
      expect(call.detail).toContain('German (de)')
      expect(call.detail).toContain('photo.png')
    })

    it('stays silent on a clean paste', () => {
      writeClipboardBuffer(makePayload([q('text', 'p1', 'P1')]))
      const { vm } = mountHost()

      vm.pasteClipboard()

      expect(toast.add).not.toHaveBeenCalled()
    })
  })

  describe('native ClipboardEvent handlers', () => {
    it('handleCopyEvent writes the payload onto the event and the buffer, and prevents default', () => {
      const editor = useEditorStore()
      const a = addNode('text')
      editor.select(a)
      const { vm } = mountHost()
      const e = fakeClipboardEvent()

      vm.handleCopyEvent(e)

      expect(e.preventDefault).toHaveBeenCalled()
      const written = JSON.parse(e.clipboardData!.getData('application/json')) as NodesPayload
      expect(written.nodes.map((n) => n.id)).toEqual([a])
      expect(readClipboardBuffer<NodesPayload>()?.nodes.map((n) => n.id)).toEqual([a])
    })

    it('handleCopyEvent is a no-op with an empty selection', () => {
      const { vm } = mountHost()
      const e = fakeClipboardEvent()

      vm.handleCopyEvent(e)

      expect(e.preventDefault).not.toHaveBeenCalled()
      expect(hasClipboardBuffer()).toBe(false)
    })

    it('handleCutEvent removes the selection and writes the event + buffer', () => {
      const editor = useEditorStore()
      const form = useFormStore()
      const a = addNode('text')
      const b = addNode('text')
      editor.select(a)
      const { vm } = mountHost()
      const e = fakeClipboardEvent()

      vm.handleCutEvent(e)

      expect(e.preventDefault).toHaveBeenCalled()
      expect(form.doc?.children.map((n) => n.id)).toEqual([b])
      expect(readClipboardBuffer<NodesPayload>()?.nodes.map((n) => n.id)).toEqual([a])
    })

    it('handlePasteEvent prefers the event payload over the buffer', () => {
      const form = useFormStore()
      writeClipboardBuffer(makePayload([q('text', 'from_buffer', 'Buffer')]))
      const eventPayload = makePayload([q('text', 'from_event', 'Event')])
      const e = fakeClipboardEvent({ 'application/json': JSON.stringify(eventPayload) })
      const { vm } = mountHost()

      vm.handlePasteEvent(e)

      expect(e.preventDefault).toHaveBeenCalled()
      expect(form.doc?.children.map((n) => n.name)).toEqual(['from_event'])
    })

    it('handlePasteEvent falls back to the buffer when the event carries nothing usable', () => {
      const form = useFormStore()
      writeClipboardBuffer(makePayload([q('text', 'from_buffer', 'Buffer')]))
      const e = fakeClipboardEvent({ 'text/plain': 'just some ordinary pasted text' })
      const { vm } = mountHost()

      vm.handlePasteEvent(e)

      expect(e.preventDefault).toHaveBeenCalled()
      expect(form.doc?.children.map((n) => n.name)).toEqual(['from_buffer'])
    })

    it('handlePasteEvent is a no-op when neither the event nor the buffer carries anything', () => {
      const form = useFormStore()
      const e = fakeClipboardEvent()
      const { vm } = mountHost()

      vm.handlePasteEvent(e)

      expect(e.preventDefault).not.toHaveBeenCalled()
      expect(form.doc?.children).toHaveLength(0)
    })
  })
})
