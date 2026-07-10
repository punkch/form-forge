import { describe, expect, it } from 'vitest'

import {
  coerceEmbedConfig,
  isEnvelope,
  isHostRequestType,
  isWireAttachment,
  parseLoadFormPayload,
  parseSaveFormat,
  PROTOCOL_CHANNEL,
  PROTOCOL_VERSION,
} from '@/embed/protocol'

const envelope = (type: string, extra: Record<string, unknown> = {}): Record<string, unknown> =>
  ({ channel: PROTOCOL_CHANNEL, v: PROTOCOL_VERSION, type, ...extra })

describe('embed protocol guards', () => {
  it('isEnvelope accepts only the form-forge channel at version 1', () => {
    expect(isEnvelope(envelope('init'))).toBe(true)
    expect(isEnvelope({ channel: 'other', v: 1, type: 'init' })).toBe(false)
    expect(isEnvelope({ channel: PROTOCOL_CHANNEL, v: 2, type: 'init' })).toBe(false)
    expect(isEnvelope({ channel: PROTOCOL_CHANNEL, v: 1 })).toBe(false)
    expect(isEnvelope(null)).toBe(false)
    expect(isEnvelope('form-forge')).toBe(false)
    expect(isEnvelope([])).toBe(false)
  })

  it('isHostRequestType knows exactly the four request types', () => {
    for (const type of ['init', 'load-form', 'save-form', 'set-config']) {
      expect(isHostRequestType(type)).toBe(true)
    }
    // Builder-emitted types must never be treated as requests (loop guard).
    for (const type of ['ready', 'init-result', 'state-changed', 'error', 'nope']) {
      expect(isHostRequestType(type)).toBe(false)
    }
  })

  it('isWireAttachment requires filename, mediatype and an ArrayBuffer', () => {
    const data = new ArrayBuffer(4)
    expect(isWireAttachment({ filename: 'a.csv', mediatype: 'text/csv', data })).toBe(true)
    expect(isWireAttachment({ filename: 'a.csv', mediatype: 'text/csv', data: [1, 2] })).toBe(false)
    expect(isWireAttachment({ filename: 'a.csv', data })).toBe(false)
    expect(isWireAttachment(null)).toBe(false)
  })
})

describe('parseLoadFormPayload', () => {
  it('accepts the three formats', () => {
    const data = new ArrayBuffer(8)
    expect(parseLoadFormPayload({ format: 'archive', data }))
      .toEqual({ ok: true, payload: { format: 'archive', data } })
    expect(parseLoadFormPayload({ format: 'object', doc: { schemaVersion: 1 }, attachments: [] }))
      .toEqual({ ok: true, payload: { format: 'object', doc: { schemaVersion: 1 }, attachments: [] } })
    expect(parseLoadFormPayload({ format: 'new' }))
      .toEqual({ ok: true, payload: { format: 'new', title: undefined } })
    expect(parseLoadFormPayload({ format: 'new', title: 'T' }))
      .toEqual({ ok: true, payload: { format: 'new', title: 'T' } })
  })

  it('rejects malformed payloads as bad-request', () => {
    expect(parseLoadFormPayload(undefined)).toEqual({ ok: false, error: 'bad-request' })
    expect(parseLoadFormPayload({})).toEqual({ ok: false, error: 'bad-request' })
    expect(parseLoadFormPayload({ format: 'archive', data: 'zip' })).toEqual({ ok: false, error: 'bad-request' })
    expect(parseLoadFormPayload({ format: 'object', doc: null, attachments: [] })).toEqual({ ok: false, error: 'bad-request' })
    expect(parseLoadFormPayload({ format: 'object', doc: {}, attachments: [{ filename: 1 }] })).toEqual({ ok: false, error: 'bad-request' })
    expect(parseLoadFormPayload({ format: 'new', title: 7 })).toEqual({ ok: false, error: 'bad-request' })
  })

  it('rejects unknown formats as unsupported-format', () => {
    expect(parseLoadFormPayload({ format: 'xlsform' })).toEqual({ ok: false, error: 'unsupported-format' })
  })
})

describe('parseSaveFormat', () => {
  it('defaults to archive and accepts the two formats', () => {
    expect(parseSaveFormat(undefined)).toEqual({ ok: true, format: 'archive' })
    expect(parseSaveFormat({})).toEqual({ ok: true, format: 'archive' })
    expect(parseSaveFormat({ format: 'archive' })).toEqual({ ok: true, format: 'archive' })
    expect(parseSaveFormat({ format: 'object' })).toEqual({ ok: true, format: 'object' })
  })

  it('flags unknown formats and malformed options', () => {
    expect(parseSaveFormat({ format: 'pdf' })).toEqual({ ok: false, error: 'unsupported-format' })
    expect(parseSaveFormat({ format: 42 })).toEqual({ ok: false, error: 'bad-request' })
    expect(parseSaveFormat('archive')).toEqual({ ok: false, error: 'bad-request' })
  })
})

describe('coerceEmbedConfig', () => {
  it('keeps only the export flags the host actually sent (no undefined fillers)', () => {
    expect(coerceEmbedConfig({
      exports: { xform: false, xlsform: true, zip: 'yes' },
      persistence: 'local',
      locale: 'en',
      extra: true,
    })).toEqual({
      // zip carried a non-boolean, so it is absent — not `undefined` — which
      // lets the store merge exports per key without clobbering other flags.
      exports: { xform: false, xlsform: true },
      persistence: 'local',
      locale: 'en',
    })
  })

  it('emits an empty exports object when the host sent exports with no valid flags', () => {
    expect(coerceEmbedConfig({ exports: { zip: 'nope' } })).toEqual({ exports: {} })
    // A single disabled flag comes through alone, not padded with the others.
    expect(coerceEmbedConfig({ exports: { xform: false } })).toEqual({ exports: { xform: false } })
  })

  it('drops invalid values and tolerates non-objects', () => {
    expect(coerceEmbedConfig({ persistence: 'cloud', locale: '' })).toEqual({})
    expect(coerceEmbedConfig(null)).toEqual({})
    expect(coerceEmbedConfig('memory')).toEqual({})
  })
})
