import { DEFAULT_LANG, type Lang, type LocalizedText } from './types'

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
