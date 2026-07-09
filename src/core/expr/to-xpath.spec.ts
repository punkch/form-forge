import { describe, expect, it } from 'vitest'

import { createNode, newDocument } from '../model/factory'
import { insertNode } from '../model/ops'
import type { FormDocument, FormNode } from '../model/types'
import { buildSymbolTable } from './symbol-table'
import { relativePath, rewriteToXPath } from './to-xpath'

/**
 * Fixture:
 * /data/name           (text)
 * /data/hh             (group)
 *   /data/hh/head_age  (integer)
 * /data/members        (repeat)
 *   /data/members/age  (integer)
 *   /data/members/sub  (group)
 *     /data/members/sub/note_1 (note)
 */
const buildFixture = (): { doc: FormDocument, nodes: Record<string, FormNode> } => {
  const doc = newDocument('T')
  const nodes: Record<string, FormNode> = {}
  const add = (key: string, type: string, parent: string | null, name: string): void => {
    const node = createNode(doc, type)
    node.name = name
    insertNode(doc, node, parent === null ? null : nodes[parent].id)
    nodes[key] = node
  }
  add('name', 'text', null, 'name')
  add('hh', 'group', null, 'hh')
  add('head_age', 'integer', 'hh', 'head_age')
  add('members', 'repeat', null, 'members')
  add('age', 'integer', 'members', 'age')
  add('sub', 'group', 'members', 'sub')
  add('note1', 'note', 'sub', 'note_1')
  return { doc, nodes }
}

describe('relativePath', () => {
  it.each([
    ['/data/members/age', '/data/members/count', '../count'],
    ['/data/members/sub/note_1', '/data/members/age', '../../age'],
    ['/data/members/age', '/data/members/sub/note_1', '../sub/note_1'],
    ['/data/a', '/data/b', '../b'],
  ])('%s → %s = %s', (from, to, expected) => {
    expect(relativePath(from, to)).toBe(expected)
  })
})

describe('rewriteToXPath', () => {
  const { doc } = buildFixture()
  const symbols = buildSymbolTable(doc)

  it('rewrites top-level refs to absolute paths', () => {
    const { result, issues } = rewriteToXPath('${name} != ""', {
      symbols, contextPath: '/data/hh/head_age', mode: 'bind',
    })
    expect(issues).toEqual([])
    expect(result).toBe('/data/name != ""')
  })

  it('rewrites refs into groups as absolute paths', () => {
    const { result } = rewriteToXPath('${head_age} > 18', {
      symbols, contextPath: '/data/name', mode: 'bind',
    })
    expect(result).toBe('/data/hh/head_age > 18')
  })

  it('uses relative paths within the same repeat', () => {
    const { result } = rewriteToXPath('${age} >= 0', {
      symbols, contextPath: '/data/members/age', mode: 'bind',
    })
    expect(result).toBe('../age >= 0')
  })

  it('climbs nested groups inside a repeat', () => {
    const { result } = rewriteToXPath('${age}', {
      symbols, contextPath: '/data/members/sub/note_1', mode: 'bind',
    })
    expect(result).toBe('../../age')
  })

  it('uses absolute paths for refs outside the repeat', () => {
    const { result } = rewriteToXPath('${name}', {
      symbols, contextPath: '/data/members/age', mode: 'bind',
    })
    expect(result).toBe('/data/name')
  })

  it('anchors same-repeat refs with current() in itemset predicates', () => {
    const { result } = rewriteToXPath('state=${age}', {
      symbols, contextPath: '/data/members/age', mode: 'itemset-predicate',
    })
    expect(result).toBe('state=current()/../age')
  })

  it('leaves bare column names and strings untouched', () => {
    const { result } = rewriteToXPath("state=${name} and county='${x}'", {
      symbols, contextPath: '/data/name', mode: 'itemset-predicate',
    })
    expect(result).toBe("state=/data/name and county='${x}'")
  })

  it('reports unknown refs and keeps the token', () => {
    const { result, issues } = rewriteToXPath('${ghost} = 1', {
      symbols, contextPath: '/data/name', mode: 'bind', nodeId: 'n1',
    })
    expect(result).toBe('${ghost} = 1')
    expect(issues[0]).toMatchObject({ code: 'expr.unknown-ref', severity: 'error', scope: { nodeId: 'n1' } })
  })

  it('reports ambiguous refs', () => {
    const { doc: dupDoc } = buildFixture()
    const extra = createNode(dupDoc, 'text')
    extra.name = 'age'
    insertNode(dupDoc, extra, null)
    const dupSymbols = buildSymbolTable(dupDoc)
    const { issues } = rewriteToXPath('${age}', {
      symbols: dupSymbols, contextPath: '/data/name', mode: 'bind',
    })
    expect(issues[0].code).toBe('expr.ambiguous-ref')
  })

  it('passes raw XPath through untouched', () => {
    const raw = "instance('crops')/root/item[name = /data/name]/yield"
    const { result, issues } = rewriteToXPath(raw, { symbols, mode: 'bind' })
    expect(result).toBe(raw)
    expect(issues).toEqual([])
  })
})
