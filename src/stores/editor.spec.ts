import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useEditorStore } from './editor'

describe('editor store selection', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('select(id) collapses the selection to a single anchor', () => {
    const editor = useEditorStore()
    editor.selectMany(['a', 'b', 'c'])

    editor.select('b')

    expect(editor.selectedNodeId).toBe('b')
    expect([...editor.selectedNodeIds]).toEqual(['b'])
  })

  it('select(null) clears both the anchor and the set', () => {
    const editor = useEditorStore()
    editor.select('a')

    editor.select(null)

    expect(editor.selectedNodeId).toBeNull()
    expect(editor.selectedNodeIds.size).toBe(0)
  })

  describe('toggleSelect', () => {
    it('toggling a new id in adds it and makes it the anchor', () => {
      const editor = useEditorStore()
      editor.select('a')

      editor.toggleSelect('b')

      expect(editor.selectedNodeId).toBe('b')
      expect([...editor.selectedNodeIds]).toEqual(['a', 'b'])
    })

    it('toggling a non-anchor id out leaves the anchor untouched', () => {
      const editor = useEditorStore()
      editor.select('a')
      editor.toggleSelect('b')
      editor.toggleSelect('c') // anchor is now 'c'; set = {a, b, c}

      editor.toggleSelect('b')

      expect(editor.selectedNodeId).toBe('c')
      expect([...editor.selectedNodeIds]).toEqual(['a', 'c'])
    })

    it('toggling the anchor out hands the anchor to the last-remaining id by insertion order', () => {
      const editor = useEditorStore()
      editor.select('a')
      editor.toggleSelect('b')
      editor.toggleSelect('c') // insertion order a, b, c; anchor = c

      editor.toggleSelect('c') // anchor toggled out

      expect(editor.selectedNodeId).toBe('b') // last remaining by insertion order
      expect([...editor.selectedNodeIds]).toEqual(['a', 'b'])
    })

    it('toggling the anchor out of a single-element selection clears the anchor entirely', () => {
      const editor = useEditorStore()
      editor.select('a')

      editor.toggleSelect('a')

      expect(editor.selectedNodeId).toBeNull()
      expect(editor.selectedNodeIds.size).toBe(0)
    })

    it('toggling into an empty selection adds it as the sole member and anchor', () => {
      const editor = useEditorStore()
      editor.toggleSelect('a')

      expect(editor.selectedNodeId).toBe('a')
      expect([...editor.selectedNodeIds]).toEqual(['a'])
    })
  })

  describe('selectRange', () => {
    const order = ['a', 'b', 'c', 'd', 'e']

    it('selects the inclusive range from the anchor forward, anchor unchanged', () => {
      const editor = useEditorStore()
      editor.select('b')

      editor.selectRange('d', order)

      expect(editor.selectedNodeId).toBe('b') // anchor stays
      expect([...editor.selectedNodeIds]).toEqual(['b', 'c', 'd'])
    })

    it('selects the inclusive range from the anchor backward', () => {
      const editor = useEditorStore()
      editor.select('d')

      editor.selectRange('b', order)

      expect(editor.selectedNodeId).toBe('d')
      expect([...editor.selectedNodeIds]).toEqual(['b', 'c', 'd'])
    })

    it('repeated shift-clicks re-range from the same anchor rather than accumulating', () => {
      const editor = useEditorStore()
      editor.select('a')
      editor.selectRange('c', order)

      editor.selectRange('b', order) // shorter re-range from the same anchor

      expect(editor.selectedNodeId).toBe('a')
      expect([...editor.selectedNodeIds]).toEqual(['a', 'b'])
    })

    it('falls back to select(id) when there is no anchor yet', () => {
      const editor = useEditorStore()

      editor.selectRange('c', order)

      expect(editor.selectedNodeId).toBe('c')
      expect([...editor.selectedNodeIds]).toEqual(['c'])
    })

    it('falls back to select(id) when the anchor is stale (not in orderedIds)', () => {
      const editor = useEditorStore()
      editor.select('stale-id')

      editor.selectRange('c', order)

      expect(editor.selectedNodeId).toBe('c')
      expect([...editor.selectedNodeIds]).toEqual(['c'])
    })
  })

  describe('selectMany', () => {
    it('replaces the selection and anchors on the first id', () => {
      const editor = useEditorStore()
      editor.select('z')

      editor.selectMany(['x', 'y'])

      expect(editor.selectedNodeId).toBe('x')
      expect([...editor.selectedNodeIds]).toEqual(['x', 'y'])
    })

    it('an empty iterable clears the selection like select(null)', () => {
      const editor = useEditorStore()
      editor.select('a')

      editor.selectMany([])

      expect(editor.selectedNodeId).toBeNull()
      expect(editor.selectedNodeIds.size).toBe(0)
    })
  })

  describe('pruneSelection', () => {
    it('drops stale ids and leaves a still-valid anchor untouched', () => {
      const editor = useEditorStore()
      editor.select('a')
      editor.toggleSelect('b')
      editor.toggleSelect('c') // anchor = c; set = {a, b, c}

      editor.pruneSelection(new Set(['a', 'c']))

      expect(editor.selectedNodeId).toBe('c')
      expect([...editor.selectedNodeIds]).toEqual(['a', 'c'])
    })

    it('hands the anchor to the last-remaining id by insertion order when the anchor itself is pruned', () => {
      const editor = useEditorStore()
      editor.select('a')
      editor.toggleSelect('b')
      editor.toggleSelect('c') // anchor = c; insertion order a, b, c

      editor.pruneSelection(new Set(['a', 'b']))

      expect(editor.selectedNodeId).toBe('b')
      expect([...editor.selectedNodeIds]).toEqual(['a', 'b'])
    })

    it('clears the anchor entirely when nothing survives', () => {
      const editor = useEditorStore()
      editor.select('a')
      editor.toggleSelect('b')

      editor.pruneSelection(new Set())

      expect(editor.selectedNodeId).toBeNull()
      expect(editor.selectedNodeIds.size).toBe(0)
    })
  })

  it('reset() clears both the anchor and the set', () => {
    const editor = useEditorStore()
    editor.select('a')
    editor.toggleSelect('b')

    editor.reset()

    expect(editor.selectedNodeId).toBeNull()
    expect(editor.selectedNodeIds.size).toBe(0)
  })
})
