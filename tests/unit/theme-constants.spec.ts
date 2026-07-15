// Pure theme-constants unit tests — node env, NO document/window access.
// Pins the single source of truth (src/theme/constants.ts) that the ui store,
// embed protocol, Appearance UI, no-FOUC inline script and CSS generator share.
import { describe, expect, it } from 'vitest'

import {
  ACCENT_IDS,
  ACCENTS,
  DEFAULT_ACCENT,
  DEFAULT_THEME,
  isAccentId,
  isThemeScheme,
  resolveScheme,
  THEME_SCHEMES,
  type ResolvedScheme,
  type ThemeScheme,
} from '@/theme/constants'

describe('resolveScheme', () => {
  it('passes concrete schemes through unchanged, ignoring the OS state', () => {
    expect(resolveScheme('light', false)).toBe('light')
    expect(resolveScheme('light', true)).toBe('light')
    expect(resolveScheme('dark', false)).toBe('dark')
    expect(resolveScheme('dark', true)).toBe('dark')
  })

  it('follows the OS boolean when the preference is system', () => {
    expect(resolveScheme('system', true)).toBe('dark')
    expect(resolveScheme('system', false)).toBe('light')
  })

  it('never returns system for any combination', () => {
    const results: ResolvedScheme[] = THEME_SCHEMES.flatMap((theme) => [
      resolveScheme(theme, true),
      resolveScheme(theme, false),
    ])
    for (const r of results) expect(r === 'light' || r === 'dark').toBe(true)
  })
})

describe('isThemeScheme', () => {
  it('accepts every declared scheme', () => {
    for (const scheme of THEME_SCHEMES) expect(isThemeScheme(scheme)).toBe(true)
  })

  it('rejects unknown strings and non-strings', () => {
    for (const bad of ['System', 'Dark', 'auto', '', 'blue', null, undefined, 42, {}, ['light']]) {
      expect(isThemeScheme(bad)).toBe(false)
    }
  })
})

describe('isAccentId', () => {
  it('accepts every declared accent id', () => {
    for (const id of ACCENT_IDS) expect(isAccentId(id)).toBe(true)
  })

  it('rejects unknown strings and non-strings', () => {
    for (const bad of ['Blue', 'orange', 'BLUE', '', 'system', null, undefined, 0, {}, ['blue']]) {
      expect(isAccentId(bad)).toBe(false)
    }
  })
})

describe('THEME_SCHEMES', () => {
  it('is exactly light, dark, system', () => {
    expect([...THEME_SCHEMES]).toEqual(['light', 'dark', 'system'])
  })
})

describe('ACCENTS', () => {
  it('has unique ids that include the base blue scale', () => {
    const ids = ACCENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('blue')
  })

  it('gives every accent a lowercase #rrggbb hex500', () => {
    for (const accent of ACCENTS) {
      expect(accent.hex500, accent.id).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('keeps ACCENT_IDS in lockstep with ACCENTS (same ids, same order)', () => {
    expect([...ACCENT_IDS]).toEqual(ACCENTS.map((a) => a.id))
  })
})

describe('defaults', () => {
  it('DEFAULT_THEME is a valid scheme and is system', () => {
    expect(isThemeScheme(DEFAULT_THEME)).toBe(true)
    const asScheme: ThemeScheme = DEFAULT_THEME
    expect(asScheme).toBe('system')
  })

  it('DEFAULT_ACCENT is a valid accent id and is purple', () => {
    expect(isAccentId(DEFAULT_ACCENT)).toBe(true)
    expect(DEFAULT_ACCENT).toBe('purple')
    expect(ACCENT_IDS).toContain(DEFAULT_ACCENT)
  })
})
