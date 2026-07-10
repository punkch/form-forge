import { computed, type ComputedRef } from 'vue'

import { DEFAULT_LANG, type Lang } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

export interface EditingLanguage {
  /** The language localized inputs read and write; DEFAULT_LANG when no display language is set. */
  editingLang: ComputedRef<Lang>
  /** True while a non-default language is selected (editor.displayLanguage set). */
  isTranslating: ComputedRef<boolean>
  /** Badge caption for localized inputs: the selected language key (e.g. "French (fr)"), or null. */
  languageBadge: ComputedRef<string | null>
}

/**
 * The single per-language editing seam for the properties panel. Wraps the
 * editor store's `displayLanguage` (null = DEFAULT_LANG sentinel) — the same
 * state the Translations dialog's "Show in editor" select and the panel's
 * compact editing-language control drive. No new state lives here.
 */
export const useEditingLanguage = (): EditingLanguage => {
  const editor = useEditorStore()
  const form = useFormStore()
  // Clamp to a language the form actually declares. form.undo can shrink
  // doc.languages while editor.displayLanguage still points at the removed
  // one; without this guard the panel would write translations into an
  // undeclared language (orphan keys) and its badge would name a language
  // that no longer exists. An undeclared selection reads as DEFAULT_LANG.
  const displayLanguage = computed<Lang | null>(() => {
    const lang = editor.displayLanguage
    if (lang === null) return null
    return (form.doc?.languages ?? []).includes(lang) ? lang : null
  })
  const editingLang = computed<Lang>(() => displayLanguage.value ?? DEFAULT_LANG)
  const isTranslating = computed(() => displayLanguage.value !== null)
  const languageBadge = computed(() => displayLanguage.value)
  return { editingLang, isTranslating, languageBadge }
}
