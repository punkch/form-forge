/**
 * Best-matches a browser/OS language tag (`navigator.language`, e.g.
 * 'fr-CA') against the app's registered UI locales. Tries an exact match
 * first, then the primary subtag (`fr-CA` → `fr`), case-insensitively;
 * falls back to `fallback` when nothing matches. Pure and side-effect
 * free so it's unit-testable without touching i18n/DOM state.
 */
export const detectPreferredLocale = (
  browserTag: string,
  availableLocales: readonly string[],
  fallback: string
): string => {
  const normalized = browserTag.toLowerCase()
  const exact = availableLocales.find((code) => code.toLowerCase() === normalized)
  if (exact) return exact
  const primary = normalized.split('-')[0]
  const bySubtag = availableLocales.find((code) => code.toLowerCase() === primary)
  return bySubtag ?? fallback
}
