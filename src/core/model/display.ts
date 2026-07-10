import { flatten } from './ops'
import { DEFAULT_LANG, type FormDocument, type Lang, type LocalizedText } from './types'

/** Best display value: requested language → default → first non-empty. */
export const displayText = (text: LocalizedText | undefined, lang?: Lang): string => {
  if (text === undefined) return ''
  if (lang !== undefined) {
    const exact = text[lang]
    if (exact !== undefined && exact !== '') return exact
  }
  const fallback = text[DEFAULT_LANG]
  if (fallback !== undefined && fallback !== '') return fallback
  for (const value of Object.values(text)) {
    if (value !== undefined && value !== '') return value
  }
  return ''
}

/** The value for exactly this language — no fallback (translation grid cells). */
export const exactText = (text: LocalizedText | undefined, lang: Lang = DEFAULT_LANG): string =>
  text?.[lang] ?? ''

/**
 * The first `limit` non-empty question labels (best display value) — the text
 * preview shown on gallery/template cards. Pure derivation from the document
 * tree; callers own the limit.
 */
export const documentPreviewLabels = (doc: FormDocument, limit: number): string[] =>
  flatten(doc.children)
    .filter((n) => n.kind === 'question')
    .map((n) => displayText(n.label))
    .filter((label) => label !== '')
    .slice(0, limit)

/** Writes a value for the given language (default sentinel when omitted). */
export const setText = (
  text: LocalizedText | undefined,
  value: string,
  lang: Lang = DEFAULT_LANG
): LocalizedText | undefined => {
  const next: LocalizedText = { ...text, [lang]: value }
  if (value === '') delete next[lang]
  return Object.keys(next).length === 0 ? undefined : next
}
