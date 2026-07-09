import { defineStore } from 'pinia'
import { ref } from 'vue'

export type EditorDialog =
  | 'settings'
  | 'translations'
  | 'choice-lists'
  | 'attachments'
  | 'import'
  | 'export'
  | null

/** Transient editor UI state (not persisted with the form). */
export const useEditorStore = defineStore('editor', () => {
  const selectedNodeId = ref<string | null>(null)
  const collapsedIds = ref<Set<string>>(new Set())
  const activeDialog = ref<EditorDialog>(null)
  const paletteVisible = ref(true)
  const previewVisible = ref(false)
  /** Canvas/property-panel display language; null = the DEFAULT_LANG sentinel. */
  const displayLanguage = ref<string | null>(null)

  const select = (id: string | null): void => { selectedNodeId.value = id }

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
  }

  return {
    selectedNodeId,
    collapsedIds,
    activeDialog,
    paletteVisible,
    previewVisible,
    displayLanguage,
    select,
    toggleExpanded,
    reset,
  }
})
