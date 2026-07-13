import { describe, expect, it } from 'vitest'

import { coerceEmbedConfig } from '@/embed/protocol'
import { ACCENT_IDS, THEME_SCHEMES } from '@/theme/constants'

/**
 * Theme/accent are additive embed-config keys (no protocol version bump),
 * coerced exactly like `locale`/`persistence`: valid values pass through,
 * unknown/absent values are dropped silently.
 */
describe('coerceEmbedConfig — theme & accent', () => {
  it('passes through every valid theme scheme, including system', () => {
    for (const theme of THEME_SCHEMES) {
      expect(coerceEmbedConfig({ theme })).toEqual({ theme })
    }
  })

  it('passes through every valid accent id', () => {
    for (const accent of ACCENT_IDS) {
      expect(coerceEmbedConfig({ accent })).toEqual({ accent })
    }
  })

  it('keeps theme and accent alongside the other config keys', () => {
    expect(coerceEmbedConfig({
      persistence: 'local',
      locale: 'en',
      theme: 'dark',
      accent: 'teal',
    })).toEqual({
      persistence: 'local',
      locale: 'en',
      theme: 'dark',
      accent: 'teal',
    })
  })

  it('drops unknown, empty, and wrongly-typed theme/accent values', () => {
    expect(coerceEmbedConfig({ theme: 'System' })).toEqual({})
    expect(coerceEmbedConfig({ theme: 'high-contrast' })).toEqual({})
    expect(coerceEmbedConfig({ theme: '' })).toEqual({})
    expect(coerceEmbedConfig({ theme: 1 })).toEqual({})
    expect(coerceEmbedConfig({ accent: 'magenta' })).toEqual({})
    expect(coerceEmbedConfig({ accent: 'Blue' })).toEqual({})
    expect(coerceEmbedConfig({ accent: '' })).toEqual({})
    expect(coerceEmbedConfig({ accent: null })).toEqual({})
  })

  it('drops one invalid dimension while keeping the other valid one', () => {
    expect(coerceEmbedConfig({ theme: 'dark', accent: 'magenta' })).toEqual({ theme: 'dark' })
    expect(coerceEmbedConfig({ theme: 'nope', accent: 'rose' })).toEqual({ accent: 'rose' })
  })
})
