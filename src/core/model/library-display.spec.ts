import { describe, expect, it } from 'vitest'

import { formatVersion, languageCodes } from './library-display'

describe('formatVersion', () => {
  it('renders 12-digit timestamp versions as date.time', () => {
    expect(formatVersion('202607101734')).toBe('2026-07-10.1734')
    expect(formatVersion('202512310001')).toBe('2025-12-31.0001')
  })

  it('leaves non-timestamp versions untouched', () => {
    expect(formatVersion('3')).toBe('3')
    expect(formatVersion('2.0.1')).toBe('2.0.1')
    expect(formatVersion('')).toBe('')
    expect(formatVersion('20260710')).toBe('20260710') // 8 digits
    expect(formatVersion('2026071017345')).toBe('2026071017345') // 13 digits
    expect(formatVersion('v202607101734')).toBe('v202607101734')
  })

  it('leaves 12-digit strings with impossible dates untouched', () => {
    expect(formatVersion('100000000000')).toBe('100000000000') // month 00
    expect(formatVersion('209913999999')).toBe('209913999999') // month 13
    expect(formatVersion('202607321734')).toBe('202607321734') // day 32
    expect(formatVersion('202607102534')).toBe('202607102534') // hour 25
  })
})

describe('languageCodes', () => {
  it('extracts trailing codes and uppercases them', () => {
    expect(languageCodes(['English (en)', 'French (fr)'])).toEqual(['EN', 'FR'])
    expect(languageCodes(['Français (fr-CA)'])).toEqual(['FR-CA'])
  })

  it('keeps names without a code as-is', () => {
    expect(languageCodes(['Français'])).toEqual(['Français'])
  })

  it('returns empty for no declared languages', () => {
    expect(languageCodes([])).toEqual([])
  })
})
