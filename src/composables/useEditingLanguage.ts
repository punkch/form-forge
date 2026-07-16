import { computed, type ComputedRef } from 'vue'

import { primaryLang } from '@/core/model/translations'
import { DEFAULT_LANG, type Lang } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

export interface EditingLanguage {
  /** The language localized inputs read and write; the form's primary language
   * when no display language is set (DEFAULT_LANG only with zero languages). */
  editingLang: ComputedRef<Lang>
  /** The language the form's text is authored in — primaryLang(doc). */
  primaryLang: ComputedRef<Lang>
  /** True while a non-primary language is being edited (a multilingual form
   * with a display language other than the primary selected). */
  isTranslating: ComputedRef<boolean>
  /** Badge caption for localized inputs: the edited language key (e.g. "French (fr)") while translating, or null. */
  languageBadge: ComputedRef<string | null>
  /** Select options for the declared languages — named languages only, no
   * pseudo-entries (shared by the panel and dialog language selects). */
  languageOptions: ComputedRef<Array<{ label: Lang, value: Lang }>>
}

/**
 * The single per-language editing seam for the properties panel. Wraps the
 * editor store's `displayLanguage` (null = follow the form's primary
 * language) — the same state the Translations dialog's "Show in editor"
 * select and the panel's compact editing-language control drive. No new
 * state lives here.
 */
export const useEditingLanguage = (): EditingLanguage => {
  const editor = useEditorStore()
  const form = useFormStore()
  const primary = computed<Lang>(() =>
    form.doc === null ? DEFAULT_LANG : primaryLang(form.doc)
  )
  // Clamp to a language the form actually declares. form.undo can shrink
  // doc.languages while editor.displayLanguage still points at the removed
  // one; without this guard the panel would write translations into an
  // undeclared language (orphan keys) and its badge would name a language
  // that no longer exists. An undeclared selection falls back to the primary.
  const displayLanguage = computed<Lang | null>(() => {
    const lang = editor.displayLanguage
    if (lang === null) return null
    return (form.doc?.languages ?? []).includes(lang) ? lang : null
  })
  const editingLang = computed<Lang>(() => displayLanguage.value ?? primary.value)
  const isTranslating = computed(() =>
    (form.doc?.languages.length ?? 0) > 0 && editingLang.value !== primary.value
  )
  const languageBadge = computed(() => (isTranslating.value ? editingLang.value : null))
  const languageOptions = computed(() =>
    (form.doc?.languages ?? []).map((lang) => ({ label: lang, value: lang }))
  )
  return { editingLang, primaryLang: primary, isTranslating, languageBadge, languageOptions }
}
