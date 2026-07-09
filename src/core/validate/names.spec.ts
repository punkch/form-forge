import { describe, expect, it } from 'vitest'

import { createNode, newDocument } from '../model/factory'
import { insertNode } from '../model/ops'
import { NAME_RE, validateNames } from './names'

describe('NAME_RE', () => {
  it.each(['age', '_hidden', 'a1', 'a.b-c_d', 'Q'])('accepts %s', (name) => {
    expect(NAME_RE.test(name)).toBe(true)
  })

  it.each(['1age', '-x', '.x', 'a b', 'é', ''])('rejects %j', (name) => {
    expect(NAME_RE.test(name)).toBe(false)
  })
})

describe('validateNames', () => {
  it('passes a clean document', () => {
    const doc = newDocument('T')
    insertNode(doc, createNode(doc, 'text'), null)
    insertNode(doc, createNode(doc, 'integer'), null)
    expect(validateNames(doc)).toEqual([])
  })

  it('flags duplicates on every duplicate node', () => {
    const doc = newDocument('T')
    const a = createNode(doc, 'text')
    insertNode(doc, a, null)
    const b = createNode(doc, 'integer')
    b.name = a.name
    insertNode(doc, b, null)
    const issues = validateNames(doc)
    expect(issues.filter((i) => i.code === 'name.duplicate')).toHaveLength(2)
    expect(issues.every((i) => i.severity === 'error')).toBe(true)
  })

  it('flags invalid and reserved names', () => {
    const doc = newDocument('T')
    const bad = createNode(doc, 'text')
    bad.name = '1bad name'
    insertNode(doc, bad, null)
    const reserved = createNode(doc, 'text')
    reserved.name = 'meta'
    insertNode(doc, reserved, null)
    const codes = validateNames(doc).map((i) => i.code)
    expect(codes).toContain('name.invalid')
    expect(codes).toContain('name.reserved')
  })
})
