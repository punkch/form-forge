import { describe, expect, it } from 'vitest'

import { detectPreferredLocale } from './detectLocale'

const locales = ['en', 'fr', 'es'] as const

describe('detectPreferredLocale', () => {
  it('returns an exact match', () => {
    expect(detectPreferredLocale('fr', locales, 'en')).toBe('fr')
  })

  it('matches by primary subtag when the full tag carries a region', () => {
    expect(detectPreferredLocale('fr-CA', locales, 'en')).toBe('fr')
    expect(detectPreferredLocale('es-MX', locales, 'en')).toBe('es')
  })

  it('falls back when nothing matches', () => {
    expect(detectPreferredLocale('de', locales, 'en')).toBe('en')
  })

  it('matches case-insensitively', () => {
    expect(detectPreferredLocale('FR-ca', locales, 'en')).toBe('fr')
  })

  it('falls back gracefully on empty/malformed input without throwing', () => {
    expect(() => detectPreferredLocale('', locales, 'en')).not.toThrow()
    expect(detectPreferredLocale('', locales, 'en')).toBe('en')
  })
})
