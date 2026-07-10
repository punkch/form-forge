import { defineStore } from 'pinia'
import { ref } from 'vue'

export type EditorDialog =
  | 'settings'
  | 'translations'
  | 'choice-lists'
  | 'attachments'
  | 'dataset-preview'
  | 'import'
  | 'export'
  | 'help-reference'
  | 'help-type'
  | null

/** Transient editor UI state (not persisted with the form). */
export const useEditorStore = defineStore('editor', () => {
  const selectedNodeId = ref<string | null>(null)
  const collapsedIds = ref<Set<string>>(new Set())
  const activeDialog = ref<EditorDialog>(null)
  const previewVisible = ref(false)
  /** Which pane is shown in single-pane (tablet) layout mode. */
  const activePane = ref<'canvas' | 'properties' | 'preview'>('canvas')
  /** Palette slide-over state in overlay layout modes (laptop/tablet). */
  const paletteDrawerOpen = ref(false)
  /** Node to scroll into view and briefly highlight (set after adds). */
  const revealNodeId = ref<string | null>(null)
  /** Canvas/property-panel display language; null = the DEFAULT_LANG sentinel. */
  const displayLanguage = ref<string | null>(null)
  /** Attachment filename shown by the 'dataset-preview' dialog. */
  const datasetPreviewFilename = ref<string | null>(null)
  /** Question type (registry key) shown by the 'help-type' drawer. */
  const helpTypeId = ref<string | null>(null)

  const select = (id: string | null): void => { selectedNodeId.value = id }

  const openDatasetPreview = (filename: string): void => {
    datasetPreviewFilename.value = filename
    activeDialog.value = 'dataset-preview'
  }

  const openTypeHelp = (type: string): void => {
    helpTypeId.value = type
    activeDialog.value = 'help-type'
  }

  const toggleExpanded = (id: string): void => {
    const next = new Set(collapsedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    collapsedIds.value = next
  }

  const reset = (): void => {
    selectedNodeId.value = null
    collapsedIds.value = new Set()
    activeDialog.value = null
    displayLanguage.value = null
    activePane.value = 'canvas'
    paletteDrawerOpen.value = false
    revealNodeId.value = null
    datasetPreviewFilename.value = null
    helpTypeId.value = null
  }

  return {
    selectedNodeId,
    collapsedIds,
    activeDialog,
    previewVisible,
    activePane,
    paletteDrawerOpen,
    revealNodeId,
    displayLanguage,
    datasetPreviewFilename,
    helpTypeId,
    select,
    toggleExpanded,
    openDatasetPreview,
    openTypeHelp,
    reset,
  }
})
