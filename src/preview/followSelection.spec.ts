import { describe, expect, it } from 'vitest'

import { newId } from '@/core/model/ids'

import { doc, group, q, repeat } from '../../tests/helpers/doc-builders'
import type { FollowEntry, RenderedQuestion } from './followSelection'
import { buildFollowTarget, normalizeText, resolveRenderedIndex } from './followSelection'

describe('normalizeText', () => {
  it('collapses internal whitespace runs to a single space', () => {
    expect(normalizeText('Hello   world\n\tfoo')).toBe('Hello world foo')
  })

  it('trims leading and trailing whitespace', () => {
    expect(normalizeText('  hi there  ')).toBe('hi there')
  })

  it('strips markdown emphasis marks', () => {
    expect(normalizeText('**Bold** _italic_ ~strike~')).toBe('Bold italic strike')
  })
})

describe('buildFollowTarget', () => {
  it('resolves a question to its own index', () => {
    const b = q('text', 'b', 'B')
    const d = doc({ title: 'T', formId: 't', children: [q('text', 'a', 'A'), b] })
    const target = buildFollowTarget(d, b.id)
    expect(target).toEqual({
      entries: [
        { labels: ['A'], hints: [], wildcard: false },
        { labels: ['B'], hints: [], wildcard: false },
      ],
      targetIndex: 1,
    })
  })

  it('resolves a group to its first renderable descendant question', () => {
    const c = q('text', 'c', 'C')
    const g = group('g', 'Group', [c])
    const d = doc({ title: 'T', formId: 't', children: [q('text', 'a', 'A'), g] })
    const target = buildFollowTarget(d, g.id)
    expect(target?.targetIndex).toBe(1)
    expect(target?.entries[1]).toEqual({ labels: ['C'], hints: [], wildcard: false })
  })

  it('resolves a repeat to its first renderable descendant question', () => {
    const c = q('text', 'c', 'C')
    const r = repeat('r', 'Repeat', [c])
    const d = doc({ title: 'T', formId: 't', children: [r] })
    const target = buildFollowTarget(d, r.id)
    expect(target?.targetIndex).toBe(0)
    expect(target?.entries[0]).toEqual({ labels: ['C'], hints: [], wildcard: false })
  })

  it('excludes a calculate node from entries and returns null as a direct target', () => {
    const calc = q('calculate', 'calc')
    const d = doc({ title: 'T', formId: 't', children: [q('text', 'a', 'A'), calc] })
    expect(buildFollowTarget(d, calc.id)).toBeNull()
    // calculate never renders, so it never occupies a slot in the follow list.
    expect(buildFollowTarget(d, d.children[0].id)?.entries).toHaveLength(1)
  })

  it('returns null for a container with no renderable descendant', () => {
    const calc = q('calculate', 'calc')
    const g = group('g', 'Group', [calc])
    const d = doc({ title: 'T', formId: 't', children: [g] })
    expect(buildFollowTarget(d, g.id)).toBeNull()
  })

  it('collects every language value as a label candidate', () => {
    const node = q('text', 'a')
    node.label = { 'English (en)': 'Hello', 'French (fr)': 'Bonjour' }
    const d = doc({ title: 'T', formId: 't', children: [node], languages: ['English (en)', 'French (fr)'] })
    const target = buildFollowTarget(d, node.id)
    expect(target?.entries[0].labels.sort()).toEqual(['Bonjour', 'Hello'])
  })

  it('dedupes identical normalized text shared across languages', () => {
    const node = q('text', 'a')
    node.label = { 'English (en)': 'Same', 'French (fr)': ' Same ' }
    const d = doc({ title: 'T', formId: 't', children: [node], languages: ['English (en)', 'French (fr)'] })
    const target = buildFollowTarget(d, node.id)
    expect(target?.entries[0].labels).toEqual(['Same'])
  })

  it('marks a label containing a ${field} reference as wildcard', () => {
    const node = q('text', 'a', 'Value: ${other}')
    const d = doc({ title: 'T', formId: 't', children: [node] })
    const target = buildFollowTarget(d, node.id)
    expect(target?.entries[0].wildcard).toBe(true)
  })

  it('marks a question with no label and no hint as wildcard', () => {
    const node = q('text', 'a')
    const d = doc({ title: 'T', formId: 't', children: [node] })
    const target = buildFollowTarget(d, node.id)
    expect(target?.entries[0]).toEqual({ labels: [], hints: [], wildcard: true })
  })

  it('keeps a static label matchable when only the hint is dynamic', () => {
    const node = q('text', 'a', 'Alpha')
    node.hint = { default: 'Currently ${other}' }
    const d = doc({ title: 'T', formId: 't', children: [node] })
    const target = buildFollowTarget(d, node.id)
    expect(target?.entries[0]).toEqual({ labels: ['Alpha'], hints: [], wildcard: false })
  })

  it('marks a question with no label and only dynamic hints as wildcard', () => {
    const node = q('text', 'a')
    node.hint = { default: 'Currently ${other}' }
    const d = doc({ title: 'T', formId: 't', children: [node] })
    const target = buildFollowTarget(d, node.id)
    expect(target?.entries[0]).toEqual({ labels: [], hints: [], wildcard: true })
  })

  it('returns null for an unknown node id', () => {
    const d = doc({ title: 'T', formId: 't', children: [q('text', 'a', 'A')] })
    expect(buildFollowTarget(d, newId())).toBeNull()
  })
})

describe('resolveRenderedIndex', () => {
  const entry = (labels: string[], hints: string[] = [], wildcard = false): FollowEntry =>
    ({ labels, hints, wildcard })
  const rendered = (label: string, hint = ''): RenderedQuestion => ({ label, hint })

  it('resolves an exact unique label', () => {
    const entries = [entry(['Foo'])]
    const dom = [rendered('Foo')]
    expect(resolveRenderedIndex(entries, 0, dom)).toBe(0)
  })

  it('resolves duplicate labels positionally', () => {
    const entries = [entry(['Q']), entry(['Q'])]
    const dom = [rendered('Q'), rendered('Q')]
    expect(resolveRenderedIndex(entries, 0, dom)).toBe(0)
    expect(resolveRenderedIndex(entries, 1, dom)).toBe(1)
  })

  it('aligns entries hidden by relevance as a DOM subsequence', () => {
    const entries = [entry(['A']), entry(['B']), entry(['C'])]
    const dom = [rendered('A'), rendered('C')] // B is not relevant, absent from the DOM
    expect(resolveRenderedIndex(entries, 0, dom)).toBe(0)
    expect(resolveRenderedIndex(entries, 1, dom)).toBeNull()
    expect(resolveRenderedIndex(entries, 2, dom)).toBe(1)
  })

  it('keeps the tail aligned with extra DOM items from a second repeat instance', () => {
    const entries = [entry(['A']), entry(['B'])]
    const dom = [rendered('A'), rendered('B'), rendered('A'), rendered('B')]
    expect(resolveRenderedIndex(entries, 0, dom)).toBe(0)
    expect(resolveRenderedIndex(entries, 1, dom)).toBe(1)
  })

  it('falls back to hint matching when labels are empty', () => {
    const entries = [entry([], ['Some hint'])]
    const dom = [rendered('', 'Some hint')]
    expect(resolveRenderedIndex(entries, 0, dom)).toBe(0)
  })

  it('anchors a wildcard entry between its matched neighbors', () => {
    const entries = [entry(['Foo']), entry([], [], true), entry(['Bar'])]
    const dom = [rendered('Foo'), rendered('Dynamic X'), rendered('Bar')]
    expect(resolveRenderedIndex(entries, 1, dom)).toBe(1)
  })

  it('lets the target match even when a preceding hidden wildcard could steal its item', () => {
    // A ${ref}-labeled question that is currently non-relevant sits before
    // the target; matching the target is equally LCS-optimal and must win.
    const entries = [entry([], [], true), entry(['A'])]
    expect(resolveRenderedIndex(entries, 1, [rendered('A')])).toBe(0)
    expect(resolveRenderedIndex(entries, 1, [rendered('A'), rendered('Z')])).toBe(0)
  })

  it('returns null when the target entry is missing from the DOM', () => {
    const entries = [entry(['A']), entry(['B'])]
    const dom = [rendered('A')]
    expect(resolveRenderedIndex(entries, 1, dom)).toBeNull()
  })

  it('returns null when the DOM list is empty', () => {
    const entries = [entry(['A'])]
    expect(resolveRenderedIndex(entries, 0, [])).toBeNull()
  })
})
