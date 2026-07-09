import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { createNode, newDocument } from '../model/factory'
import { insertNode } from '../model/ops'
import type { FormDocument } from '../model/types'
import { rewriteFromXPath } from './from-xpath'
import { buildSymbolTable } from './symbol-table'
import { rewriteToXPath } from './to-xpath'

const buildFixture = (): FormDocument => {
  const doc = newDocument('T')
  const add = (type: string, parentId: string | null, name: string): string => {
    const node = createNode(doc, type)
    node.name = name
    insertNode(doc, node, parentId)
    return node.id
  }
  add('text', null, 'name')
  const hh = add('group', null, 'hh')
  add('integer', hh, 'head_age')
  const members = add('repeat', null, 'members')
  add('integer', members, 'age')
  return doc
}

describe('rewriteFromXPath', () => {
  const doc = buildFixture()
  const symbols = buildSymbolTable(doc)

  it('rewrites absolute paths to refs', () => {
    expect(rewriteFromXPath('/data/name != ""', { symbols })).toBe('${name} != ""')
    expect(rewriteFromXPath('/data/hh/head_age > 18', { symbols })).toBe('${head_age} > 18')
  })

  it('rewrites relative paths using the context', () => {
    expect(rewriteFromXPath('../age >= 0', { symbols, contextPath: '/data/members/age' }))
      .toBe('${age} >= 0')
  })

  it('rewrites current()/ anchored chains', () => {
    expect(rewriteFromXPath('state=current()/../age', { symbols, contextPath: '/data/members/age' }))
      .toBe('state=${age}')
  })

  it('leaves unknown paths, instance() lookups and strings alone', () => {
    const cases = [
      '/data/ghost + 1',
      "instance('crops')/root/item[name = ${crop}]/yield",
      "'/data/name'",
      '../missing',
    ]
    for (const expr of cases) {
      expect(rewriteFromXPath(expr, { symbols, contextPath: '/data/members/age' })).toBe(expr)
    }
  })

  it('does not rewrite paths whose leaf name is ambiguous', () => {
    const dup = buildFixture()
    const extra = createNode(dup, 'text')
    extra.name = 'age'
    insertNode(dup, extra, null)
    const dupSymbols = buildSymbolTable(dup)
    expect(rewriteFromXPath('/data/age', { symbols: dupSymbols })).toBe('/data/age')
  })

  it('keeps predicates attached to rewritten context intact', () => {
    // The path inside the predicate belongs to instance('x'), not the form.
    const expr = "count(/data/members/age) = count(instance('x')/root/item)"
    expect(rewriteFromXPath(expr, { symbols })).toBe(
      "count(${age}) = count(instance('x')/root/item)"
    )
  })
})

describe('property: from(to(expr)) round-trips', () => {
  const doc = buildFixture()
  const symbols = buildSymbolTable(doc)
  const names = ['name', 'head_age']

  it('holds for expressions over unique top-level/group names', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...names), { minLength: 1, maxLength: 4 }),
        fc.constantFrom(' + ', ' and ', ' = '),
        (refs, op) => {
          const expr = refs.map((n) => `\${${n}}`).join(op)
          const { result, issues } = rewriteToXPath(expr, {
            symbols, contextPath: '/data/name', mode: 'bind',
          })
          expect(issues).toEqual([])
          expect(rewriteFromXPath(result, { symbols, contextPath: '/data/name' })).toBe(expr)
        }
      ),
      { numRuns: 60 }
    )
  })

  it('holds inside repeats (relative paths)', () => {
    const expr = '${age} > 0 and ${name} != ""'
    const { result } = rewriteToXPath(expr, {
      symbols, contextPath: '/data/members/age', mode: 'bind',
    })
    expect(result).toBe('../age > 0 and /data/name != ""')
    expect(rewriteFromXPath(result, { symbols, contextPath: '/data/members/age' })).toBe(expr)
  })
})
