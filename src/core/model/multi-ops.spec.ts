import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { doc, group, q, repeat } from '../../../tests/helpers/doc-builders'
import { createNode, newDocument } from './factory'
import { gatherNodesAfter, indentNodes, moveNodesBy, outdentNodes } from './multi-ops'
import { flatten, insertNode, locateNode, topMostNodes } from './ops'
import { isContainer } from './types'

describe('moveNodesBy', () => {
  it('moves a non-contiguous selection down as one block, preserving relative order', () => {
    // A B C D E, select B and D (a gap at C between them).
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'a'), q('text', 'b'), q('text', 'c'), q('text', 'd'), q('text', 'e')],
    })
    const [a, b, c, dQ, e] = d.children
    expect(moveNodesBy(d, [b.id, dQ.id], 1)).toBe(true)
    // B swaps past C, D swaps past E — block cohesion, doc order preserved.
    expect(d.children.map((n) => n.id)).toEqual([a.id, c.id, b.id, e.id, dQ.id])
  })

  it('moves a non-contiguous selection up as one block, preserving relative order', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'a'), q('text', 'b'), q('text', 'c'), q('text', 'd'), q('text', 'e')],
    })
    const [a, b, c, dQ, e] = d.children
    expect(moveNodesBy(d, [c.id, e.id], -1)).toBe(true)
    expect(d.children.map((n) => n.id)).toEqual([a.id, c.id, b.id, e.id, dQ.id])
  })

  it('aborts the whole move (doc untouched) when any top-most node sits at the list edge', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'a'), q('text', 'b'), q('text', 'c')],
    })
    const before = structuredClone(d)
    // 'a' is already first — moving the block up must abort entirely, even
    // though 'b' alone would have room to move.
    expect(moveNodesBy(d, [d.children[0].id, d.children[1].id], -1)).toBe(false)
    expect(d).toEqual(before)
  })

  it('aborts when the last node is already at the bottom edge', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'a'), q('text', 'b'), q('text', 'c')],
    })
    const before = structuredClone(d)
    expect(moveNodesBy(d, [d.children[1].id, d.children[2].id], 1)).toBe(false)
    expect(d).toEqual(before)
  })

  it('returns false for an empty or unknown selection', () => {
    const d = doc({ title: 'T', formId: 't', children: [q('text', 'a')] })
    const before = structuredClone(d)
    expect(moveNodesBy(d, [], 1)).toBe(false)
    expect(moveNodesBy(d, ['nope'], 1)).toBe(false)
    expect(d).toEqual(before)
  })

  it('only recurses down to top-most nodes: a selected container carries its selected children along implicitly', () => {
    const inner = q('text', 'x')
    const g = group('g', 'G', [inner])
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'before'), g, q('text', 'after')],
    })
    // Selecting both the group and its child is equivalent to selecting the group alone.
    expect(moveNodesBy(d, [g.id, inner.id], 1)).toBe(true)
    expect(d.children.map((n) => n.name)).toEqual(['before', 'after', 'g'])
    expect(g.children[0].id).toBe(inner.id)
  })
})

describe('indentNodes', () => {
  it('indents a contiguous block into the preceding container, folded in document order', () => {
    const existing = q('text', 'existing')
    const d = doc({
      title: 'T',
      formId: 't',
      children: [group('g', 'G', [existing]), q('text', 'x'), q('text', 'y'), q('text', 'z')],
    })
    const [g, x, y] = d.children
    expect(indentNodes(d, [x.id, y.id])).toBe(true)
    expect(d.children.map((n) => n.name)).toEqual(['g', 'z'])
    expect(isContainer(g) && g.children.map((n) => n.id)).toEqual([existing.id, x.id, y.id])
  })

  it('aborts (doc untouched) when the first top-most node has no preceding sibling', () => {
    const d = doc({ title: 'T', formId: 't', children: [q('text', 'a'), q('text', 'b')] })
    const before = structuredClone(d)
    expect(indentNodes(d, [d.children[0].id])).toBe(false)
    expect(d).toEqual(before)
  })

  it('aborts when the preceding sibling is not a container', () => {
    const d = doc({ title: 'T', formId: 't', children: [q('text', 'a'), q('text', 'b')] })
    const before = structuredClone(d)
    expect(indentNodes(d, [d.children[1].id])).toBe(false)
    expect(d).toEqual(before)
  })

  it('returns false for an empty selection', () => {
    const d = doc({ title: 'T', formId: 't', children: [q('text', 'a')] })
    expect(indentNodes(d, [])).toBe(false)
  })
})

describe('outdentNodes', () => {
  it('outdents multiple children of the same parent in reverse document order, landing consecutively after it', () => {
    const x = q('text', 'x')
    const y = q('text', 'y')
    const keep = q('text', 'keep')
    const g = group('g', 'G', [x, y, keep])
    const after = q('text', 'after')
    const d = doc({ title: 'T', formId: 't', children: [g, after] })
    expect(outdentNodes(d, [x.id, y.id])).toBe(true)
    // x and y land right after g, in their original relative order; 'keep' stays inside.
    expect(d.children.map((n) => n.id)).toEqual([g.id, x.id, y.id, after.id])
    expect(g.children.map((n) => n.id)).toEqual([keep.id])
  })

  it('skips root-level top-most nodes instead of blocking the ones that can outdent', () => {
    const x = q('text', 'x')
    const g = group('g', 'G', [x])
    const root = q('text', 'root')
    const d = doc({ title: 'T', formId: 't', children: [g, root] })
    expect(outdentNodes(d, [x.id, root.id])).toBe(true)
    // 'root' had no parent to outdent from — it's simply left in place.
    expect(d.children.map((n) => n.id)).toEqual([g.id, x.id, root.id])
  })

  it('returns false (doc untouched) when none of the selection can outdent', () => {
    const d = doc({ title: 'T', formId: 't', children: [q('text', 'a'), q('text', 'b')] })
    const before = structuredClone(d)
    expect(outdentNodes(d, [d.children[0].id, d.children[1].id])).toBe(false)
    expect(d).toEqual(before)
  })
})

describe('gatherNodesAfter', () => {
  it('gathers root-level nodes into an existing group, right after the anchor', () => {
    const anchor = q('text', 'anchor')
    const d = doc({
      title: 'T',
      formId: 't',
      children: [group('g', 'G', [anchor]), q('text', 'p'), q('text', 'q2')],
    })
    const [, p, q2] = d.children
    expect(gatherNodesAfter(d, [p.id, q2.id], anchor.id)).toBe(true)
    const g = d.children[0]
    expect(d.children.map((n) => n.id)).toEqual([g.id])
    expect(isContainer(g) && g.children.map((n) => n.id)).toEqual([anchor.id, p.id, q2.id])
  })

  it('preserves selection document order when reordering within the same parent', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'anchor'), q('text', 'x'), q('text', 'y'), q('text', 'z')],
    })
    const [anchor, x, y] = d.children
    expect(gatherNodesAfter(d, [x.id, y.id], anchor.id)).toBe(true)
    // x and y already followed the anchor — order stays x, y, then the untouched z.
    expect(d.children.map((n) => n.id)).toEqual([anchor.id, x.id, y.id, d.children[3].id])
  })

  it('reorders selected nodes from before the anchor to land right after it, in selection order', () => {
    const d = doc({
      title: 'T',
      formId: 't',
      children: [q('text', 'x'), q('text', 'y'), q('text', 'anchor'), q('text', 'z')],
    })
    const [x, y, anchor] = d.children
    expect(gatherNodesAfter(d, [x.id, y.id], anchor.id)).toBe(true)
    expect(d.children.map((n) => n.id)).toEqual([anchor.id, x.id, y.id, d.children[3].id])
  })

  it("no-ops a selected direct ancestor of the anchor (moveNode's own-subtree guard) while other nodes still gather", () => {
    const anchor = q('text', 'anchor')
    const g = group('g', 'G', [anchor])
    const other = q('text', 'other')
    const d = doc({ title: 'T', formId: 't', children: [g, other] })
    // Selecting the anchor's own parent alongside an unrelated sibling: the
    // parent can't be moved into its own subtree, but 'other' still gathers.
    expect(gatherNodesAfter(d, [g.id, other.id], anchor.id)).toBe(true)
    expect(d.children.map((n) => n.id)).toEqual([g.id])
    expect(g.children.map((n) => n.id)).toEqual([anchor.id, other.id])
  })

  it('no-ops a selected grandparent of the anchor the same way (dragged-descendant fallback safety net)', () => {
    const anchor = q('text', 'anchor')
    const inner = group('inner', 'Inner', [anchor])
    const outer = group('outer', 'Outer', [inner])
    const other = q('text', 'other')
    const d = doc({ title: 'T', formId: 't', children: [outer, other] })
    // A NodeList drag never calls gatherNodesAfter in this shape (the dragged
    // card falls back to a single-node move when its own ancestor is also
    // selected) — this pins that the core primitive stays safe even so.
    expect(gatherNodesAfter(d, [outer.id, other.id], anchor.id)).toBe(true)
    expect(d.children.map((n) => n.id)).toEqual([outer.id])
    expect(outer.children.map((n) => n.id)).toEqual([inner.id])
    expect(inner.children.map((n) => n.id)).toEqual([anchor.id, other.id])
  })

  it('returns false for an unknown anchor', () => {
    const d = doc({ title: 'T', formId: 't', children: [q('text', 'a'), q('text', 'b')] })
    const before = structuredClone(d)
    expect(gatherNodesAfter(d, [d.children[0].id], 'nope')).toBe(false)
    expect(d).toEqual(before)
  })

  it('returns false when the selection is the anchor alone', () => {
    const d = doc({ title: 'T', formId: 't', children: [q('text', 'a'), q('text', 'b')] })
    const before = structuredClone(d)
    expect(gatherNodesAfter(d, [d.children[0].id], d.children[0].id)).toBe(false)
    expect(d).toEqual(before)
  })

  it('gathers into a repeat the same way as a group', () => {
    const anchor = q('text', 'anchor')
    const d = doc({
      title: 'T',
      formId: 't',
      children: [repeat('r', 'R', [anchor]), q('text', 'p')],
    })
    const p = d.children[1]
    expect(gatherNodesAfter(d, [p.id], anchor.id)).toBe(true)
    const r = d.children[0]
    expect(d.children.map((n) => n.id)).toEqual([r.id])
    expect(isContainer(r) && r.children.map((n) => n.id)).toEqual([anchor.id, p.id])
  })
})

describe('property: random multi-ops keep the tree consistent', () => {
  const TYPES = ['text', 'integer', 'group', 'repeat', 'note'] as const

  it('unique ids and parent/child integrity survive arbitrary multi-op sequences; abort means untouched', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            build: fc.constantFrom('insert', 'insertNested'),
            type: fc.constantFrom(...TYPES),
            pick: fc.nat(),
            index: fc.nat(10),
            multiOp: fc.constantFrom('moveUp', 'moveDown', 'indent', 'outdent', 'gather'),
            selectionSize: fc.nat(4),
          }),
          { maxLength: 30 }
        ),
        (steps) => {
          const d = newDocument('prop')
          for (const step of steps) {
            // Grow the tree a bit before each multi-op, same generator shape
            // as ops.spec.ts's property test.
            const all = flatten(d.children)
            if (step.build === 'insert') {
              insertNode(d, createNode(d, step.type), null, step.index)
            } else {
              const containers = all.filter(isContainer)
              const parent = containers.length > 0 ? containers[step.pick % containers.length] : null
              insertNode(d, createNode(d, step.type), parent?.id ?? null, step.index)
            }

            const pool = flatten(d.children)
            if (pool.length === 0) continue
            const selection = new Set<string>()
            for (let i = 0; i < step.selectionSize && i < pool.length; i++) {
              selection.add(pool[(step.pick + i) % pool.length].id)
            }
            if (selection.size === 0) continue
            const before = JSON.stringify(d)

            let changed: boolean
            switch (step.multiOp) {
              case 'moveUp': changed = moveNodesBy(d, selection, -1); break
              case 'moveDown': changed = moveNodesBy(d, selection, 1); break
              case 'indent': changed = indentNodes(d, selection); break
              case 'outdent': changed = outdentNodes(d, selection); break
              case 'gather': {
                const anchor = pool[step.pick % pool.length]
                changed = gatherNodesAfter(d, selection, anchor.id)
                break
              }
            }
            if (!changed) expect(JSON.stringify(d)).toBe(before)

            // Invariants after every step, mirroring ops.spec.ts's property test.
            const nodes = flatten(d.children)
            const ids = nodes.map((n) => n.id)
            expect(new Set(ids).size).toBe(ids.length)
            for (const n of nodes) expect(locateNode(d, n.id)).not.toBeNull()
            // topMostNodes over the same selection never exceeds the doc size
            // and every id it returns is still resolvable.
            const top = topMostNodes(d, [...selection].filter((id) => ids.includes(id)))
            expect(top.length).toBeLessThanOrEqual(nodes.length)
            for (const n of top) expect(ids).toContain(n.id)
          }
        }
      ),
      { numRuns: 50 }
    )
  })
})
