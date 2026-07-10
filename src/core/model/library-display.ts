/**
 * Pure display helpers for library form cards. Formatting only — the raw
 * stored values stay untouched (Form settings keeps editing them verbatim).
 */

import { languageCode } from './translations'

/** The factory's pyxform-style default version stamp: yyyymmddHHMM,
 * with plausible calendar month/day so arbitrary 12-digit versions
 * (e.g. "100000000000") pass through instead of formatting as fake dates. */
const TIMESTAMP_VERSION = /^(\d{4})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([01]\d|2[0-3])([0-5]\d)$/

/**
 * 12-digit timestamp versions render as the readable "2026-07-10.1734";
 * anything else passes through as-is.
 */
export const formatVersion = (version: string): string => {
  const match = TIMESTAMP_VERSION.exec(version)
  if (match === null) return version
  const [, year, month, day, hour, minute] = match
  return `${year}-${month}-${day}.${hour}${minute}`
}

/**
 * Short badge codes from declared languages: 'French (fr)' → 'FR' (the
 * languageKey code suffix, uppercased); a language declared without a code
 * keeps its full name.
 */
export const languageCodes = (languages: readonly string[]): string[] =>
  languages.map((lang) => languageCode(lang)?.toUpperCase() ?? lang)
