import { describe, expect, it } from 'vitest'

import { parseHeader } from './columns'

describe('parseHeader', () => {
  it.each([
    ['label', { base: 'label', rawBase: 'label' }],
    ['label::English (en)', { base: 'label', rawBase: 'label', lang: 'English (en)' }],
    ['  hint::Français (fr) ', { base: 'hint', rawBase: 'hint', lang: 'Français (fr)' }],
    ['media::image', { base: 'image', rawBase: 'image' }],
    ['media::image::English (en)', { base: 'image', rawBase: 'image', lang: 'English (en)' }],
    ['media::big-image', { base: 'big-image', rawBase: 'big-image' }],
    ['big_image', { base: 'big-image', rawBase: 'big_image' }],
    ['guidance_hint', { base: 'guidance_hint', rawBase: 'guidance_hint' }],
    ['constraint message', { base: 'constraint_message', rawBase: 'constraint message' }],
    ['required message', { base: 'required_message', rawBase: 'required message' }],
    ['repeat count', { base: 'repeat_count', rawBase: 'repeat count' }],
    ['read only', { base: 'read_only', rawBase: 'read only' }],
    ['readonly', { base: 'read_only', rawBase: 'readonly' }],
    ['relevance', { base: 'relevant', rawBase: 'relevance' }],
    ['caption', { base: 'label', rawBase: 'caption' }],
    ['command', { base: 'type', rawBase: 'command' }],
    ['list name', { base: 'list_name', rawBase: 'list name' }],
    ['title', { base: 'form_title', rawBase: 'title' }],
    ['id_string', { base: 'form_id', rawBase: 'id_string' }],
    ['dataset', { base: 'list_name', rawBase: 'dataset' }],
    ['My Custom Column', { base: 'my_custom_column', rawBase: 'My Custom Column' }],
  ])('parses %j', (header, expected) => {
    expect(parseHeader(header)).toEqual(expected)
  })

  it('maps value → name only on the choices sheet', () => {
    expect(parseHeader('value', 'choices').base).toBe('name')
    expect(parseHeader('value', 'survey').base).toBe('value')
  })

  it('keeps passthrough prefixes with the attribute spelling intact', () => {
    expect(parseHeader('bind::jr:constraintMsg')).toEqual({
      base: 'bind::jr:constraintMsg',
      rawBase: 'bind::jr:constraintMsg',
    })
    expect(parseHeader('instance::my_attribute')).toEqual({
      base: 'instance::my_attribute',
      rawBase: 'instance::my_attribute',
    })
    expect(parseHeader('Body::accuracyThreshold').base).toBe('body::accuracyThreshold')
  })

  it('flags legacy single-colon separators', () => {
    expect(parseHeader('label:English (en)')).toEqual({
      base: 'label',
      rawBase: 'label',
      lang: 'English (en)',
      legacySeparator: true,
    })
    expect(parseHeader('bind:relevant')).toEqual({
      base: 'bind::relevant',
      rawBase: 'bind:relevant',
      legacySeparator: true,
    })
  })

  it('keeps language suffixes byte-identical', () => {
    expect(parseHeader('label::ŘŠţ (x-klingon)').lang).toBe('ŘŠţ (x-klingon)')
  })
})
