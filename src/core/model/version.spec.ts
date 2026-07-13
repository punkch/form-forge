import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { bumpVersion, defaultVersion } from './version'

describe('defaultVersion', () => {
  it('produces a 12-digit yyyymmddHHMM timestamp', () => {
    expect(defaultVersion()).toMatch(/^\d{12}$/)
  })

  it('zero-pads month, day, hour and minute', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 2, 3, 4)) // 2026-01-02 03:04
    expect(defaultVersion()).toBe('202601020304')
    vi.useRealTimers()
  })
})

describe('bumpVersion', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 13, 15, 30)) // 2026-07-13 15:30
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns a fresh timestamp when there is no current version', () => {
    expect(bumpVersion()).toBe('202607131530')
    expect(bumpVersion('')).toBe('202607131530')
  })

  it('returns a distinct string when current equals a freshly generated timestamp', () => {
    const now = defaultVersion()
    const bumped = bumpVersion(now)
    expect(bumped).not.toBe(now)
    expect(bumped).toBe('202607131530-2')
  })

  it('increments an existing -N counter suffix on the same minute', () => {
    expect(bumpVersion('202607131530-2')).toBe('202607131530-3')
    expect(bumpVersion('202607131530-9')).toBe('202607131530-10')
  })

  it('returns the fresh timestamp when current is an older, different version', () => {
    expect(bumpVersion('201501010101')).toBe('202607131530')
    expect(bumpVersion('template-version')).toBe('202607131530')
  })

  it('is always distinct from current', () => {
    for (const current of ['202607131530', '202607131530-2', '201501010101', 'x', '202607131530-99']) {
      expect(bumpVersion(current)).not.toBe(current)
    }
  })
})
