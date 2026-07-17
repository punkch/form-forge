import { describe, expect, it } from 'vitest'

import { group, q } from '../../../tests/helpers/doc-builders'
import { imageDefaultFilename, isDynamicDefault, JR_IMAGES_PREFIX, stripImagePrefix } from './defaults'

describe('isDynamicDefault', () => {
  it.each([['today()', true], ['${age}', true], ['1.5', false], ['yes', false], ['2026-01-01', false]])(
    '%s → %s', (value, expected) => {
      expect(isDynamicDefault(value)).toBe(expected)
    })
})

describe('stripImagePrefix', () => {
  it('removes a leading jr://images/ prefix', () => {
    expect(stripImagePrefix(`${JR_IMAGES_PREFIX}template.png`)).toBe('template.png')
  })

  it('is idempotent — a value already stripped passes through unchanged', () => {
    expect(stripImagePrefix('template.png')).toBe('template.png')
  })

  it('leaves values without the prefix untouched', () => {
    expect(stripImagePrefix('not-a-jr-uri.png')).toBe('not-a-jr-uri.png')
    expect(stripImagePrefix('')).toBe('')
  })
})

describe('imageDefaultFilename', () => {
  it('returns the bare filename for a static image default', () => {
    const node = q('image', 'photo', undefined, { defaultValue: 'template.png' })
    expect(imageDefaultFilename(node)).toBe('template.png')
  })

  it('strips a legacy jr://images/-prefixed default', () => {
    const node = q('image', 'photo', undefined, { defaultValue: `${JR_IMAGES_PREFIX}template.png` })
    expect(imageDefaultFilename(node)).toBe('template.png')
  })

  it('is undefined for a dynamic default', () => {
    const node = q('image', 'photo', undefined, { defaultValue: '${other}' })
    expect(imageDefaultFilename(node)).toBeUndefined()
  })

  it('is undefined for an empty or unset default', () => {
    expect(imageDefaultFilename(q('image', 'photo'))).toBeUndefined()
    expect(imageDefaultFilename(q('image', 'photo', undefined, { defaultValue: '' }))).toBeUndefined()
  })

  it('is undefined for a non-image question type', () => {
    const node = q('text', 'name', undefined, { defaultValue: 'template.png' })
    expect(imageDefaultFilename(node)).toBeUndefined()
  })

  it('is undefined for a group/repeat node', () => {
    expect(imageDefaultFilename(group('g', 'G', []))).toBeUndefined()
  })
})
