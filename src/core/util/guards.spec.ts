import { describe, expect, it } from 'vitest'

import { isRecord } from './guards'

describe('isRecord', () => {
  it('accepts plain objects only', () => {
    expect(isRecord({})).toBe(true)
    expect(isRecord({ a: 1 })).toBe(true)
    expect(isRecord(Object.create(null))).toBe(true)
  })

  it('rejects null, arrays and primitives', () => {
    expect(isRecord(null)).toBe(false)
    expect(isRecord(undefined)).toBe(false)
    expect(isRecord([])).toBe(false)
    expect(isRecord([1, 2])).toBe(false)
    expect(isRecord('x')).toBe(false)
    expect(isRecord(7)).toBe(false)
    expect(isRecord(true)).toBe(false)
  })
})
