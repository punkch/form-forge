import { describe, expect, it } from 'vitest'

import { coerceEmbedConfig } from '@/embed/protocol'
import { ACCENT_IDS, CONTRAST_PREFS, THEME_SCHEMES } from '@/theme/constants'

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

/**
 * Contrast is a third, additive embed-config key — same coercion contract as
 * theme/accent: valid values (including `system`) pass through, unknown/absent
 * values are dropped silently, no protocol-version bump.
 */
describe('coerceEmbedConfig — contrast', () => {
  it('passes through every valid contrast pref, including system', () => {
    for (const contrast of CONTRAST_PREFS) {
      expect(coerceEmbedConfig({ contrast })).toEqual({ contrast })
    }
  })

  it('keeps contrast alongside theme and accent', () => {
    expect(coerceEmbedConfig({ theme: 'dark', accent: 'teal', contrast: 'high' })).toEqual({
      theme: 'dark', accent: 'teal', contrast: 'high',
    })
  })

  it('drops unknown, empty, and wrongly-typed contrast values', () => {
    expect(coerceEmbedConfig({ contrast: 'System' })).toEqual({})
    expect(coerceEmbedConfig({ contrast: 'extreme' })).toEqual({})
    expect(coerceEmbedConfig({ contrast: '' })).toEqual({})
    expect(coerceEmbedConfig({ contrast: 1 })).toEqual({})
    expect(coerceEmbedConfig({ contrast: null })).toEqual({})
  })

  it('leaves contrast absent when not sent, even alongside a valid theme/accent', () => {
    const config = coerceEmbedConfig({ theme: 'light', accent: 'rose' })
    expect(config.contrast).toBeUndefined()
  })
})
