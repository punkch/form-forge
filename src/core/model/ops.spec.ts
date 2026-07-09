import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { createNode, newDocument } from './factory'
import {
  cloneSubtree,
  containsNode,
  countQuestions,
  findNode,
  flatten,
  insertNode,
  locateNode,
  moveNode,
  removeNode,
  uniqueName,
} from './ops'
import { isContainer, type FormDocument, type FormNode } from './types'

const buildDoc = (): { doc: FormDocument, text: FormNode, group: FormNode, inner: FormNode } => {
  const doc = newDocument('Test form')
  const text = createNode(doc, 'text')
  insertNode(doc, text, null)
  const group = createNode(doc, 'group')
  insertNode(doc, group, null)
  const inner = createNode(doc, 'integer')
  insertNode(doc, inner, group.id)
  return { doc, text, group, inner }
}

describe('insertNode / findNode / locateNode', () => {
  it('inserts at root and inside containers', () => {
    const { doc, text, group, inner } = buildDoc()
    expect(doc.children).toHaveLength(2)
    expect(findNode(doc, text.id)).toBe(text)
    expect(findNode(doc, inner.id)).toBe(inner)
    const loc = locateNode(doc, inner.id)
    expect(loc?.parent?.id).toBe(group.id)
    expect(loc?.index).toBe(0)
  })

  it('rejects inserting into a non-container', () => {
    const { doc, text } = buildDoc()
    const extra = createNode(doc, 'text')
    expect(insertNode(doc, extra, text.id)).toBe(false)
  })

  it('clamps the insertion index', () => {
    const { doc } = buildDoc()
    const extra = createNode(doc, 'note')
    expect(insertNode(doc, extra, null, 99)).toBe(true)
    expect(doc.children.at(-1)?.id).toBe(extra.id)
  })
})

describe('removeNode', () => {
  it('removes nested nodes and returns them', () => {
    const { doc, inner, group } = buildDoc()
    const removed = removeNode(doc, inner.id)
    expect(removed?.id).toBe(inner.id)
    expect(findNode(doc, inner.id)).toBeNull()
    expect(isContainer(group) && group.children).toHaveLength(0)
  })

  it('returns null for unknown ids', () => {
    const { doc } = buildDoc()
    expect(removeNode(doc, 'nope')).toBeNull()
  })
})

describe('moveNode', () => {
  it('moves a root node into a group', () => {
    const { doc, text, group } = buildDoc()
    expect(moveNode(doc, text.id, group.id, 0)).toBe(true)
    expect(doc.children).toHaveLength(1)
    expect(locateNode(doc, text.id)?.parent?.id).toBe(group.id)
  })

  it('moves out of a group to a root index', () => {
    const { doc, inner } = buildDoc()
    expect(moveNode(doc, inner.id, null, 0)).toBe(true)
    expect(doc.children[0].id).toBe(inner.id)
  })

  it('compensates indices when moving forward within the same list', () => {
    const doc = newDocument('T')
    const a = createNode(doc, 'text')
    const b = createNode(doc, 'integer')
    const c = createNode(doc, 'decimal')
    insertNode(doc, a, null)
    insertNode(doc, b, null)
    insertNode(doc, c, null)
    // Move a to be after b (visual index 2)
    expect(moveNode(doc, a.id, null, 2)).toBe(true)
    expect(doc.children.map((n) => n.id)).toEqual([b.id, a.id, c.id])
  })

  it('refuses to move a group into its own subtree', () => {
    const { doc, group, inner } = buildDoc()
    // inner is a question — nest another group first
    const sub = createNode(doc, 'group')
    insertNode(doc, sub, group.id)
    expect(moveNode(doc, group.id, sub.id, 0)).toBe(false)
    expect(containsNode(group, sub.id)).toBe(true)
    expect(findNode(doc, inner.id)).not.toBeNull()
  })
})

describe('cloneSubtree', () => {
  it('gives fresh ids and unique names recursively', () => {
    const { doc, group, inner } = buildDoc()
    const clone = cloneSubtree(doc, group)
    expect(clone.id).not.toBe(group.id)
    expect(clone.name).not.toBe(group.name)
    expect(isContainer(clone)).toBe(true)
    if (isContainer(clone)) {
      expect(clone.children[0].id).not.toBe(inner.id)
      expect(clone.children[0].name).not.toBe(inner.name)
    }
  })
})

describe('uniqueName / countQuestions', () => {
  it('appends numeric suffixes for collisions', () => {
    const { doc } = buildDoc()
    const name = doc.children[0].name
    expect(uniqueName(doc, name)).toBe(`${name}_2`)
  })

  it('counts questions but not containers', () => {
    const { doc } = buildDoc()
    expect(countQuestions(doc)).toBe(2)
    expect(flatten(doc.children)).toHaveLength(3)
  })
})

describe('property: random op sequences keep the tree consistent', () => {
  const TYPES = ['text', 'integer', 'group', 'repeat', 'note'] as const

  it('unique ids and parent/child integrity survive arbitrary ops', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            op: fc.constantFrom('insert', 'insertNested', 'remove', 'move'),
            type: fc.constantFrom(...TYPES),
            pick: fc.nat(),
            index: fc.nat(10),
          }),
          { maxLength: 40 }
        ),
        (steps) => {
          const doc = newDocument('prop')
          for (const step of steps) {
            const all = flatten(doc.children)
            switch (step.op) {
              case 'insert':
                insertNode(doc, createNode(doc, step.type), null, step.index)
                break
              case 'insertNested': {
                const containers = all.filter(isContainer)
                const parent = containers.length > 0 ? containers[step.pick % containers.length] : null
                insertNode(doc, createNode(doc, step.type), parent?.id ?? null, step.index)
                break
              }
              case 'remove':
                if (all.length > 0) removeNode(doc, all[step.pick % all.length].id)
                break
              case 'move': {
                if (all.length === 0) break
                const node = all[step.pick % all.length]
                const containers = flatten(doc.children).filter(isContainer)
                const target = step.index % 2 === 0 || containers.length === 0
                  ? null
                  : containers[step.pick % containers.length]
                moveNode(doc, node.id, target?.id ?? null, step.index)
                break
              }
            }
            // Invariants after every step:
            const nodes = flatten(doc.children)
            const ids = nodes.map((n) => n.id)
            expect(new Set(ids).size).toBe(ids.length)
            for (const n of nodes) {
              const loc = locateNode(doc, n.id)
              expect(loc).not.toBeNull()
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})
