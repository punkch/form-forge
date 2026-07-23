import { useToast } from 'primevue/usetoast'
import { computed, onScopeDispose, ref, type ComputedRef } from 'vue'

import { hasClipboardBuffer, onClipboardBufferChange, readClipboardBuffer, writeClipboardBuffer } from '@/clipboard/buffer'
import { applyToClipboardEvent, payloadFromClipboardEvent, writeSystemClipboard } from '@/clipboard/system'
import type { MergeResult, MergeTarget } from '@/core/clipboard/merge'
import { serializeNodesPayload, tryParseClipboardText, type NodesPayload } from '@/core/clipboard/payload'
import { locateNode } from '@/core/model/ops'
import { isContainer, type FormDocument } from '@/core/model/types'
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

export interface SelectionActions {
  canCut: ComputedRef<boolean>
  canCopy: ComputedRef<boolean>
  canDelete: ComputedRef<boolean>
  canPaste: ComputedRef<boolean>
  copySelection: () => void
  cutSelection: () => void
  deleteSelection: () => void
  pasteClipboard: () => void
  handleCopyEvent: (e: ClipboardEvent) => void
  handleCutEvent: (e: ClipboardEvent) => void
  handlePasteEvent: (e: ClipboardEvent) => void
  insertionTarget: () => MergeTarget
  revealMergeResult: (result: MergeResult) => void
}

/**
 * The one UI-facing seam for canvas cut/copy/paste/delete: wires the form
 * store's clipboard actions (src/stores/form.ts) to the hybrid clipboard
 * transport (src/clipboard/) and the editor store's selection, and resolves
 * where a paste lands. Shared by the canvas toolbar, the document-level
 * keyboard shortcuts and the native ClipboardEvent listeners (Task 9) — all
 * of them just call into this, never the store/transport directly.
 */
export const useSelectionActions = (): SelectionActions => {
  const form = useFormStore()
  const editor = useEditorStore()
  const { t } = useAppI18n()
  const toast = useToast()

  // canPaste needs to react to buffer writes from THIS tab and `storage`
  // events from other tabs; onClipboardBufferChange only signals "something
  // changed", so this re-reads hasClipboardBuffer() on every fire.
  const clipboardHasContent = ref(hasClipboardBuffer())
  const unsubscribe = onClipboardBufferChange(() => { clipboardHasContent.value = hasClipboardBuffer() })
  onScopeDispose(unsubscribe)

  const canCut = computed(() => form.doc !== null && editor.selectedNodeIds.size > 0)
  const canCopy = canCut
  const canDelete = canCut
  const canPaste = computed(() => form.doc !== null && clipboardHasContent.value)

  /** THE selection-relative insertion rule, shared by paste and the
   * palette's click-to-add (FormEditorView.addFromPalette): into the
   * selected node when it's an open (non-collapsed) container, else right
   * after the selection in its own parent, else the end of the form. */
  const insertionTarget = (): MergeTarget => {
    if (form.doc === null) return { parentId: null }
    const selected = form.getNode(editor.selectedNodeId)
    if (selected === null) return { parentId: null }
    if (isContainer(selected) && !editor.collapsedIds.has(selected.id)) {
      return { parentId: selected.id }
    }
    const loc = locateNode(form.doc as FormDocument, selected.id)
    return loc === null ? { parentId: null } : { parentId: loc.parent?.id ?? null, index: loc.index + 1 }
  }

  /** Informational toast for whatever a merge degraded rather than errored
   * on (dropped languages, filenames that need re-attaching, stripped
   * save_to links) — silent when the merge was clean. Shared with
   * insert-from-template, whose merge can degrade the same ways. */
  const notifyMergeOutcome = (result: MergeResult): void => {
    const details: string[] = []
    if (result.dormantLanguages.length > 0) {
      details.push(t('canvas.pasteToast.dormantLanguages', { languages: result.dormantLanguages.join(', ') }))
    }
    if (result.attachmentFilenames.length > 0) {
      details.push(t('canvas.pasteToast.missingAttachments', { filenames: result.attachmentFilenames.join(', ') }))
    }
    if (result.strippedSaveTo > 0) {
      details.push(t('canvas.pasteToast.strippedSaveTo', { count: result.strippedSaveTo }, result.strippedSaveTo))
    }
    if (details.length === 0) return
    toast.add({ severity: 'info', summary: t('canvas.pasteToast.title'), detail: details.join(' '), life: 6000 })
  }

  /** Post-merge reveal, shared by paste and insert-from-template: select
   * every inserted node (anchored on the first, matching `revealNodeId`),
   * flash it into view via the existing reveal mechanics
   * (TreeNodeCard.revealIfTargeted), and raise the degradation toast. */
  const revealMergeResult = (result: MergeResult): void => {
    editor.selectMany(result.insertedIds)
    editor.revealNodeId = result.insertedIds[0] ?? null
    notifyMergeOutcome(result)
  }

  /** Merge `payload` at the resolved target, then reveal the result.
   * Returns false when the merge itself declined (empty payload, no open
   * doc). */
  const applyPaste = (payload: NodesPayload): boolean => {
    const result = form.pasteNodes(payload, insertionTarget())
    if (result === null) return false
    revealMergeResult(result)
    return true
  }

  const performCopy = (): NodesPayload | null => {
    const payload = form.copyNodes(editor.selectedNodeIds)
    if (payload !== null) writeClipboardBuffer(payload)
    return payload
  }

  const performCut = (): NodesPayload | null => {
    const payload = form.cutNodes(editor.selectedNodeIds)
    if (payload !== null) writeClipboardBuffer(payload)
    return payload
  }

  const copySelection = (): void => {
    const payload = performCopy()
    if (payload !== null) writeSystemClipboard(serializeNodesPayload(payload))
  }

  const cutSelection = (): void => {
    const payload = performCut()
    if (payload !== null) writeSystemClipboard(serializeNodesPayload(payload))
  }

  const deleteSelection = (): void => {
    form.deleteNodes(editor.selectedNodeIds)
    editor.select(null)
  }

  /** Buffer-only paste (no system-clipboard read, so no permission prompt) —
   * the toolbar/keyboard-shortcut path. */
  const pasteClipboard = (): void => {
    const payload = readClipboardBuffer<NodesPayload>()
    if (payload === null) return
    applyPaste(payload)
  }

  /** Native `copy`: prefer writing straight into the event's clipboardData
   * (works synchronously on a real user-gesture event, no permission
   * prompt) over the best-effort async Clipboard API used by the button
   * path. */
  const handleCopyEvent = (e: ClipboardEvent): void => {
    const payload = performCopy()
    if (payload === null) return
    e.preventDefault()
    applyToClipboardEvent(e, serializeNodesPayload(payload))
  }

  const handleCutEvent = (e: ClipboardEvent): void => {
    const payload = performCut()
    if (payload === null) return
    e.preventDefault()
    applyToClipboardEvent(e, serializeNodesPayload(payload))
  }

  /** Native `paste`: prefer whatever the event itself carries (an external
   * app, or another Form Forge tab via the real OS clipboard) and fall back
   * to our own buffer when the event carries nothing we recognize (e.g.
   * clipboardData withheld, or it's simply not ours). */
  const handlePasteEvent = (e: ClipboardEvent): void => {
    const eventText = payloadFromClipboardEvent(e)
    const eventPayload = eventText !== null ? tryParseClipboardText(eventText) : null
    const payload = eventPayload ?? readClipboardBuffer<NodesPayload>()
    if (payload === null) return
    e.preventDefault()
    applyPaste(payload)
  }

  return {
    canCut,
    canCopy,
    canDelete,
    canPaste,
    copySelection,
    cutSelection,
    deleteSelection,
    pasteClipboard,
    handleCopyEvent,
    handleCutEvent,
    handlePasteEvent,
    insertionTarget,
    revealMergeResult,
  }
}
