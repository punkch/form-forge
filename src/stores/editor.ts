import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { GuideKey } from '@/help/content'

export type EditorDialog =
  | 'settings'
  | 'translations'
  | 'choice-lists'
  | 'attachments'
  | 'dataset-preview'
  | 'import'
  | 'export'
  | 'help-reference'
  | 'insert-template'
  | null

/** Transient editor UI state (not persisted with the form). */
export const useEditorStore = defineStore('editor', () => {
  /** The ACTIVE/anchor node — unchanged meaning from before multi-select.
   * Invariant: `selectedNodeId` is a member of `selectedNodeIds` whenever the
   * set is non-empty (null iff the set is empty). */
  const selectedNodeId = ref<string | null>(null)
  /** The full multi-selection, always including the anchor above. A ref<Set>
   * mutated in place would NOT trigger watchers (same gotcha as
   * `collapsedIds` below) — every mutator here assigns a fresh Set. */
  const selectedNodeIds = ref<Set<string>>(new Set())
  const collapsedIds = ref<Set<string>>(new Set())
  const activeDialog = ref<EditorDialog>(null)
  const previewVisible = ref(false)
  /** Central publish/hub slide-over (right-side, non-modal), toggled from the
   * editor toolbar — mirrors previewVisible. Reset on form switch. */
  const centralDrawerOpen = ref(false)
  /** Which pane is shown in single-pane (tablet) layout mode. */
  const activePane = ref<'canvas' | 'properties' | 'preview'>('canvas')
  /** Palette slide-over state in overlay layout modes (laptop/tablet). */
  const paletteDrawerOpen = ref(false)
  /** Node to scroll into view and briefly highlight (set after adds). */
  const revealNodeId = ref<string | null>(null)
  /** Canvas/property-panel display language; null = follow the form's primary language. */
  const displayLanguage = ref<string | null>(null)
  /** Attachment filename shown by the 'dataset-preview' dialog. */
  const datasetPreviewFilename = ref<string | null>(null)
  /** Question type shown by the help drawer; null = browsable type list. */
  const helpTypeId = ref<string | null>(null)
  /** Workflow guide shown by the help drawer; null = no guide selected. */
  const helpGuideId = ref<GuideKey | null>(null)

  /** Collapse to a single selection (or clear, for null) — plain click /
   * keyboard-focus behavior. */
  const select = (id: string | null): void => {
    selectedNodeId.value = id
    selectedNodeIds.value = id === null ? new Set() : new Set([id])
  }

  /** Ctrl/Cmd+Click: toggle one id in/out of the selection. Toggling a node
   * IN makes it the new anchor. Toggling the anchor itself OUT hands the
   * anchor to the last-remaining id by insertion order (Set iteration order
   * is insertion order); toggling a non-anchor id out leaves the anchor
   * untouched (it's still in the set, invariant preserved either way). */
  const toggleSelect = (id: string): void => {
    const next = new Set(selectedNodeIds.value)
    if (next.has(id)) {
      next.delete(id)
      if (selectedNodeId.value === id) {
        const remaining = [...next]
        selectedNodeId.value = remaining.length > 0 ? remaining[remaining.length - 1] : null
      }
    } else {
      next.add(id)
      selectedNodeId.value = id
    }
    selectedNodeIds.value = next
  }

  /** Shift+Click: range-select between the anchor and `id` over `orderedIds`
   * (visible card order). The anchor itself never moves, so repeated
   * shift-clicks re-range from the same start every time. Falls back to a
   * plain `select(id)` when there is no anchor yet, or either endpoint isn't
   * in `orderedIds` (e.g. a stale anchor). */
  const selectRange = (id: string, orderedIds: string[]): void => {
    const anchor = selectedNodeId.value
    const anchorIndex = anchor === null ? -1 : orderedIds.indexOf(anchor)
    const idIndex = orderedIds.indexOf(id)
    if (anchorIndex === -1 || idIndex === -1) { select(id); return }
    const [start, end] = anchorIndex <= idIndex ? [anchorIndex, idIndex] : [idIndex, anchorIndex]
    selectedNodeIds.value = new Set(orderedIds.slice(start, end + 1))
  }

  /** Replace the whole selection (e.g. Ctrl+A, or post-paste/insert). The
   * first id (in iteration order) becomes the new anchor; an empty `ids`
   * clears the selection like `select(null)`. */
  const selectMany = (ids: Iterable<string>): void => {
    const next = new Set(ids)
    selectedNodeIds.value = next
    selectedNodeId.value = next.size > 0 ? [...next][0] : null
  }

  /** Drop ids no longer present in the document (undo/redo, drag, deletes)
   * and, if the anchor itself went stale, hand it to the last-remaining id
   * by insertion order — same fallback rule as `toggleSelect`'s anchor-out
   * case. */
  const pruneSelection = (existingIds: ReadonlySet<string>): void => {
    const next = new Set([...selectedNodeIds.value].filter((id) => existingIds.has(id)))
    // `next` is always a subset, so equal size ⇒ nothing was pruned. Keep the
    // ref's identity in that case: this runs on EVERY doc revision (each
    // property-panel keystroke), and a fresh Set would invalidate every
    // card's `selected` computed and re-render the whole canvas.
    if (next.size === selectedNodeIds.value.size) return
    selectedNodeIds.value = next
    if (selectedNodeId.value !== null && !existingIds.has(selectedNodeId.value)) {
      const remaining = [...next]
      selectedNodeId.value = remaining.length > 0 ? remaining[remaining.length - 1] : null
    }
  }

  const openDatasetPreview = (filename: string): void => {
    datasetPreviewFilename.value = filename
    activeDialog.value = 'dataset-preview'
  }

  // Deep-links the help drawer to one type's detail view. The header Help
  // button opens the same drawer in list mode by setting activeDialog
  // directly (the drawer clears helpTypeId whenever it closes).
  const openTypeHelp = (type: string): void => {
    helpGuideId.value = null
    helpTypeId.value = type
    activeDialog.value = 'help-reference'
  }

  // Deep-links the help drawer to one workflow guide's detail view (the
  // contextual "?" triggers) — exact sibling of openTypeHelp. At most one of
  // helpTypeId/helpGuideId is ever set; both null = the browsable list.
  const openGuideHelp = (key: GuideKey): void => {
    helpTypeId.value = null
    helpGuideId.value = key
    activeDialog.value = 'help-reference'
  }

  const toggleExpanded = (id: string): void => {
    const next = new Set(collapsedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    collapsedIds.value = next
  }

  const reset = (): void => {
    selectedNodeId.value = null
    selectedNodeIds.value = new Set()
    collapsedIds.value = new Set()
    activeDialog.value = null
    centralDrawerOpen.value = false
    displayLanguage.value = null
    activePane.value = 'canvas'
    paletteDrawerOpen.value = false
    revealNodeId.value = null
    datasetPreviewFilename.value = null
    helpTypeId.value = null
    helpGuideId.value = null
  }

  return {
    selectedNodeId,
    selectedNodeIds,
    collapsedIds,
    activeDialog,
    previewVisible,
    centralDrawerOpen,
    activePane,
    paletteDrawerOpen,
    revealNodeId,
    displayLanguage,
    datasetPreviewFilename,
    helpTypeId,
    helpGuideId,
    select,
    toggleSelect,
    selectRange,
    selectMany,
    pruneSelection,
    toggleExpanded,
    openDatasetPreview,
    openTypeHelp,
    openGuideHelp,
    reset,
  }
})
