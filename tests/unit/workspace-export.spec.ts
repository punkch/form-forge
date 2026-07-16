import { afterEach, describe, expect, it } from 'vitest'

import { localDateStamp } from '@/composables/useWorkspaceExport'
import { i18n, localeOptions, SUPPORTED_LOCALES, type MessageSchema } from '@/i18n'
import { appVersion } from '@/version'

describe('localDateStamp', () => {
  const originalTz = process.env.TZ

  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ
    else process.env.TZ = originalTz
  })

  it('formats local date parts as yyyy-mm-dd with zero padding', () => {
    expect(localDateStamp(new Date(2026, 0, 5, 9, 30))).toBe('2026-01-05')
    expect(localDateStamp(new Date(2026, 11, 31, 12, 0))).toBe('2026-12-31')
  })

  it('uses local parts, not UTC: a late evening west of UTC keeps its local date', () => {
    process.env.TZ = 'Etc/GMT+5' // fixed UTC-5, no DST
    const lateEvening = new Date(2026, 6, 9, 23, 30)
    // toISOString() would already have rolled over to the next UTC day…
    expect(lateEvening.toISOString().slice(0, 10)).toBe('2026-07-10')
    // …but the filename stamp stays on the user's local date.
    expect(localDateStamp(lateEvening)).toBe('2026-07-09')
  })
})

describe('appVersion', () => {
  it('returns the build-time version (semver-shaped, dev fallback included)', () => {
    // Vitest defines __APP_VERSION__ from package.json (vitest.config.ts);
    // both that and the '1.0.0-dev' fallback satisfy this shape.
    expect(appVersion()).toMatch(/^\d+\.\d+\.\d+/)
  })
})

describe('localeOptions', () => {
  it('lists the shipped en/fr/es catalogs with their native names', () => {
    expect(SUPPORTED_LOCALES.en).toBe('English')
    expect(SUPPORTED_LOCALES.fr).toBe('Français')
    expect(SUPPORTED_LOCALES.es).toBe('Español')
    // availableLocales is alphabetically sorted by vue-i18n.
    expect(localeOptions()).toEqual([
      { code: 'en', label: 'English' },
      { code: 'es', label: 'Español' },
      { code: 'fr', label: 'Français' },
    ])
  })

  it('picks up catalogs registered at runtime, falling back to the code as label', () => {
    // A deliberately partial test catalog (fallbackLocale covers the rest),
    // hence the cast past the full-schema requirement.
    i18n.global.setLocaleMessage('xx', { common: { cancel: 'X' } } as MessageSchema)
    expect(localeOptions()).toEqual([
      { code: 'en', label: 'English' },
      { code: 'es', label: 'Español' },
      { code: 'fr', label: 'Français' },
      { code: 'xx', label: 'xx' },
    ])
  })
})
