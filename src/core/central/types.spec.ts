import { describe, expect, it } from 'vitest'

import {
  CentralError,
  coerceAttachmentDescriptor,
  coerceAttachmentDescriptorList,
  coerceFormSummary,
  coerceFormSummaryList,
  coerceProject,
  coerceProjectList,
  coerceSession,
} from './types'

describe('CentralError', () => {
  it('is an Error carrying every discriminant field', () => {
    const err = new CentralError('formId already exists', {
      kind: 'conflict',
      status: 409,
      code: '409.3',
      details: { fields: ['xmlFormId'], values: ['my_form'] },
    })
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('CentralError')
    expect(err.message).toBe('formId already exists')
    expect(err.kind).toBe('conflict')
    expect(err.status).toBe(409)
    expect(err.code).toBe('409.3')
    expect(err.details).toEqual({ fields: ['xmlFormId'], values: ['my_form'] })
  })

  it('leaves the optional fields undefined when only a kind is given', () => {
    const err = new CentralError('offline', { kind: 'network' })
    expect(err.kind).toBe('network')
    expect(err.status).toBeUndefined()
    expect(err.code).toBeUndefined()
    expect(err.details).toBeUndefined()
  })
})

describe('coerceSession', () => {
  it('reads a well-formed session body', () => {
    expect(coerceSession({ token: 'abc', csrf: 'xyz', expiresAt: '2026-07-13T00:00:00Z' })).toEqual({
      token: 'abc',
      csrf: 'xyz',
      expiresAt: '2026-07-13T00:00:00Z',
    })
  })

  it('defaults a missing token to empty string and drops non-string optionals', () => {
    expect(coerceSession({ csrf: 42, expiresAt: null })).toEqual({
      token: '',
      csrf: undefined,
      expiresAt: undefined,
    })
  })

  it('coerces a non-record (malformed JSON) to safe defaults', () => {
    expect(coerceSession(undefined)).toEqual({ token: '', csrf: undefined, expiresAt: undefined })
    expect(coerceSession('not json')).toEqual({ token: '', csrf: undefined, expiresAt: undefined })
    expect(coerceSession(null)).toEqual({ token: '', csrf: undefined, expiresAt: undefined })
  })
})

describe('coerceProject', () => {
  it('reads a well-formed project and filters non-string verbs', () => {
    expect(coerceProject({ id: 5, name: 'Field survey', verbs: ['form.create', 7, 'form.update', null] })).toEqual({
      id: 5,
      name: 'Field survey',
      verbs: ['form.create', 'form.update'],
    })
  })

  it('defaults id/name/verbs when absent or wrong-typed', () => {
    expect(coerceProject({ id: '5', verbs: 'form.create' })).toEqual({ id: 0, name: '', verbs: [] })
    expect(coerceProject(null)).toEqual({ id: 0, name: '', verbs: [] })
  })
})

describe('coerceFormSummary', () => {
  it('reads a published form', () => {
    expect(coerceFormSummary({ xmlFormId: 'survey', name: 'Survey', version: '1', publishedAt: '2026-07-13T00:00:00Z' })).toEqual({
      xmlFormId: 'survey',
      name: 'Survey',
      version: '1',
      publishedAt: '2026-07-13T00:00:00Z',
    })
  })

  it('maps a null or missing publishedAt to null (never-published draft)', () => {
    expect(coerceFormSummary({ xmlFormId: 'draft', publishedAt: null })).toEqual({
      xmlFormId: 'draft',
      name: undefined,
      version: undefined,
      publishedAt: null,
    })
    expect(coerceFormSummary({}).publishedAt).toBeNull()
  })

  it('coerces a non-record (malformed JSON) to safe defaults', () => {
    expect(coerceFormSummary(null)).toEqual({
      xmlFormId: '',
      name: undefined,
      version: undefined,
      publishedAt: null,
    })
  })
})

describe('coerceAttachmentDescriptor', () => {
  it('reads a descriptor and treats a non-true exists as false', () => {
    expect(coerceAttachmentDescriptor({ name: 'villages.csv', type: 'file', hash: 'abc', exists: true })).toEqual({
      name: 'villages.csv',
      type: 'file',
      hash: 'abc',
      exists: true,
    })
    expect(coerceAttachmentDescriptor({ name: 'missing.csv', exists: 'yes' })).toEqual({
      name: 'missing.csv',
      type: undefined,
      hash: undefined,
      exists: false,
    })
    expect(coerceAttachmentDescriptor(null)).toEqual({ name: '', type: undefined, hash: undefined, exists: false })
  })
})

describe('list coercers', () => {
  it('map arrays element-wise', () => {
    expect(coerceProjectList([{ id: 1, name: 'A', verbs: [] }])).toEqual([{ id: 1, name: 'A', verbs: [] }])
    expect(coerceFormSummaryList([{ xmlFormId: 'f', publishedAt: null }])).toHaveLength(1)
    expect(coerceAttachmentDescriptorList([{ name: 'a', exists: true }])).toHaveLength(1)
  })

  it('yield an empty array for a non-array (malformed) body', () => {
    expect(coerceProjectList({})).toEqual([])
    expect(coerceProjectList(undefined)).toEqual([])
    expect(coerceFormSummaryList('nope')).toEqual([])
    expect(coerceAttachmentDescriptorList(null)).toEqual([])
  })
})
