import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { choice, doc, group, q } from '../../../tests/helpers/doc-builders'
import { newId } from '../model/ids'
import { allNames, findNode, flatten } from '../model/ops'
import { normalizeDefaultContent } from '../model/translations'
import { type ChoiceList, type FormDocument, type FormNode } from '../model/types'
import { mergeNodesIntoDoc, type MergeTarget } from './merge'
import { buildNodesPayload, CLIPBOARD_KIND, CLIPBOARD_VERSION, type NodesPayload } from './payload'

/** Build a NodesPayload directly, for tests that need precise control over
 * language keys/list content that constructing a whole source doc would
 * obscure. Mirrors buildNodesPayload's shape exactly. */
const payloadOf = (overrides: Partial<NodesPayload> & { nodes: FormNode[] }): NodesPayload => ({
  kind: CLIPBOARD_KIND,
  version: CLIPBOARD_VERSION,
  choiceLists: {},
  languages: [],
  attachmentFilenames: [],
  copiedAt: 1,
  ...overrides,
})

const ROOT: MergeTarget = { parentId: null }

describe('mergeNodesIntoDoc — target validation', () => {
  it('returns null and leaves the doc untouched for an unknown parentId', () => {
    const target = doc({ title: 'T', formId: 't', children: [q('text', 'existing', 'Existing')] })
    const before = JSON.parse(JSON.stringify(target))
    const payload = payloadOf({ nodes: [q('text', 'q1', 'Q1')] })
    expect(mergeNodesIntoDoc(target, payload, { parentId: 'nope' })).toBeNull()
    expect(target).toEqual(before)
  })

  it('returns null and leaves the doc untouched when the parent is not a container', () => {
    const leaf = q('text', 'existing', 'Existing')
    const target = doc({ title: 'T', formId: 't', children: [leaf] })
    const before = JSON.parse(JSON.stringify(target))
    const payload = payloadOf({ nodes: [q('text', 'q1', 'Q1')] })
    expect(mergeNodesIntoDoc(target, payload, { parentId: leaf.id })).toBeNull()
    expect(target).toEqual(before)
  })

  it('returns null for an empty payload', () => {
    const target = doc({ title: 'T', formId: 't', children: [] })
    expect(mergeNodesIntoDoc(target, payloadOf({ nodes: [] }), ROOT)).toBeNull()
  })

  it('inserts under a valid group parent, at the requested index', () => {
    const inner = q('text', 'a', 'A')
    const g = group('g', 'G', [inner])
    const target = doc({ title: 'T', formId: 't', children: [g] })
    const payload = payloadOf({ nodes: [q('text', 'b', 'B')] })
    const result = mergeNodesIntoDoc(target, payload, { parentId: g.id, index: 0 })
    expect(result?.insertedIds).toHaveLength(1)
    const parentNode = findNode(target, g.id)
    expect(parentNode?.kind === 'group' && parentNode.children.map((n) => n.name)).toEqual(['b', 'a'])
  })
})

describe('mergeNodesIntoDoc — name dedup', () => {
  it('dedupes a pasted node against an existing same-named node', () => {
    const target = doc({ title: 'T', formId: 't', children: [q('text', 'q1', 'Existing')] })
    const payload = payloadOf({ nodes: [q('text', 'q1', 'Pasted')] })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    const inserted = findNode(target, result?.insertedIds[0] ?? '')
    expect(inserted?.name).toBe('q1_2')
  })

  it('dedups N siblings sharing a base name in one merge, each landing on a distinct suffix', () => {
    const target = doc({ title: 'T', formId: 't', children: [q('text', 'q1', 'Existing')] })
    const payload = payloadOf({
      nodes: [q('text', 'q1', 'A'), q('text', 'q1', 'B'), q('text', 'q1', 'C')],
    })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    const names = result?.insertedIds.map((id) => findNode(target, id)?.name)
    expect(names).toEqual(['q1_2', 'q1_3', 'q1_4'])
  })

  it('materializes an implicit csv-external itemset default before the rename retargets it', () => {
    const target = doc({ title: 'T', formId: 't', children: [q('csv-external', 'lookup', 'Existing')] })
    const payload = payloadOf({ nodes: [q('csv-external', 'lookup', 'Pasted')] })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    const inserted = findNode(target, result?.insertedIds[0] ?? '')
    expect(inserted?.name).toBe('lookup_2')
    expect(inserted?.kind === 'question' && inserted.itemsetFile).toBe('lookup.csv')
  })
})

describe('mergeNodesIntoDoc — choice-list collision policy', () => {
  it('adds a list absent from the target', () => {
    const node = q('select_one', 'fav', 'Favorite', { listRef: 'colors' })
    const target = doc({ title: 'T', formId: 't', children: [] })
    const payload = payloadOf({ nodes: [node], choiceLists: { colors: { name: 'colors', choices: [choice('red', 'Red')] } } })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    expect(result?.addedLists).toEqual(['colors'])
    expect(target.choiceLists.colors?.choices.map((c) => c.name)).toEqual(['red'])
  })

  it('reuses an identical list rather than duplicating it', () => {
    const node = q('select_one', 'fav', 'Favorite', { listRef: 'colors' })
    const target = doc({
      title: 'T',
      formId: 't',
      children: [],
      choiceLists: { colors: [choice('red', 'Red')] },
    })
    const targetList = target.choiceLists.colors
    const payload = payloadOf({ nodes: [node], choiceLists: { colors: { name: 'colors', choices: [choice('red', 'Red')] } } })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    expect(result?.reusedLists).toEqual(['colors'])
    expect(result?.addedLists).toEqual([])
    expect(result?.renamedLists).toEqual([])
    // The target's own list object is untouched — never overwritten, never
    // union-merged.
    expect(target.choiceLists.colors).toBe(targetList)
    const inserted = findNode(target, result?.insertedIds[0] ?? '')
    expect(inserted?.kind === 'question' && inserted.listRef).toBe('colors')
  })

  it('reuses a list that becomes identical only after the language remap', () => {
    // Target declares only English; the source list is monolingual under the
    // DEFAULT_LANG sentinel with the same choice content. Post-remap
    // (sentinel → target primary) the two are byte-identical.
    const node = q('select_one', 'fav', 'Favorite', { listRef: 'colors' })
    const target = doc({
      title: 'T',
      formId: 't',
      children: [],
      languages: ['English (en)'],
      defaultLanguage: 'English (en)',
      choiceLists: {},
    })
    target.choiceLists.colors = { name: 'colors', choices: [{ name: 'red', label: { 'English (en)': 'Red' } }] }
    const payload = payloadOf({
      nodes: [node],
      choiceLists: { colors: { name: 'colors', choices: [choice('red', 'Red')] } }, // sentinel-shaped label
    })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    expect(result?.reusedLists).toEqual(['colors'])
  })

  it('renames a colliding list with different content and rewrites the pasted listRef', () => {
    const node = q('select_one', 'fav', 'Favorite', { listRef: 'colors' })
    const target = doc({
      title: 'T',
      formId: 't',
      children: [],
      choiceLists: { colors: [choice('red', 'Red')] },
    })
    const payload = payloadOf({
      nodes: [node],
      choiceLists: { colors: { name: 'colors', choices: [choice('green', 'Green')] } },
    })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    expect(result?.renamedLists).toEqual([{ from: 'colors', to: 'colors_2' }])
    expect(target.choiceLists.colors?.choices.map((c) => c.name)).toEqual(['red']) // untouched
    expect(target.choiceLists.colors_2?.choices.map((c) => c.name)).toEqual(['green'])
    const inserted = findNode(target, result?.insertedIds[0] ?? '')
    expect(inserted?.kind === 'question' && inserted.listRef).toBe('colors_2')
  })
})

describe('mergeNodesIntoDoc — language remap', () => {
  it('A→A: a zero-language source lands under the sentinel of a zero-language target', () => {
    const target = doc({ title: 'T', formId: 't', children: [] })
    const payload = payloadOf({ nodes: [q('text', 'q1', 'Hello')] })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    const inserted = findNode(target, result?.insertedIds[0] ?? '')
    expect(inserted?.label).toEqual({ default: 'Hello' })
    expect(result?.dormantLanguages).toEqual([])
    expect(normalizeDefaultContent(target).changed).toBe(false)
  })

  it('A→B: a zero-language source\'s sentinel content falls back to the target\'s primary language', () => {
    const target = doc({
      title: 'T',
      formId: 't',
      children: [],
      languages: ['English (en)', 'French (fr)'],
      defaultLanguage: 'English (en)',
    })
    const payload = payloadOf({ nodes: [q('text', 'q1', 'Hello')] }) // sentinel-only source
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    const inserted = findNode(target, result?.insertedIds[0] ?? '')
    expect(inserted?.label).toEqual({ 'English (en)': 'Hello' })
    expect(result?.dormantLanguages).toEqual([])
    expect(normalizeDefaultContent(target).changed).toBe(false)
  })

  it('B→A: the source primary falls back to the sentinel; the rest stays dormant in place', () => {
    const target = doc({ title: 'T', formId: 't', children: [] })
    const node = q('text', 'q1', undefined, {
      label: { 'English (en)': 'Hello', 'French (fr)': 'Salut' },
    })
    const payload = payloadOf({ nodes: [node], languages: ['English (en)', 'French (fr)'], defaultLanguage: 'English (en)' })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    const inserted = findNode(target, result?.insertedIds[0] ?? '')
    // French is retained under its own key — invisible while undeclared,
    // adopted if the user later adds a matching language.
    expect(inserted?.label).toEqual({ default: 'Hello', 'French (fr)': 'Salut' })
    expect(result?.dormantLanguages).toEqual(['French (fr)'])
    expect(normalizeDefaultContent(target).changed).toBe(false)
  })

  it('does not report a declared-but-unused source language as dropped', () => {
    // English-only content copied out of an en/fr form into an en-only form:
    // French was declared on the source but these subtrees carry no French
    // text, so nothing was actually lost — no toast-worthy drop.
    const target = doc({
      title: 'T',
      formId: 't',
      children: [],
      languages: ['English (en)'],
      defaultLanguage: 'English (en)',
    })
    const node = q('text', 'q1', undefined, { label: { 'English (en)': 'Hello' } })
    const payload = payloadOf({ nodes: [node], languages: ['English (en)', 'French (fr)'], defaultLanguage: 'English (en)' })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    expect(result?.dormantLanguages).toEqual([])
  })

  it('B→B exact key match: identical language keys pass through untouched', () => {
    const target = doc({
      title: 'T',
      formId: 't',
      children: [],
      languages: ['English (en)', 'French (fr)'],
      defaultLanguage: 'English (en)',
    })
    const node = q('text', 'q1', undefined, { label: { 'French (fr)': 'Salut' } })
    const payload = payloadOf({ nodes: [node], languages: ['English (en)', 'French (fr)'], defaultLanguage: 'English (en)' })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    const inserted = findNode(target, result?.insertedIds[0] ?? '')
    expect(inserted?.label).toEqual({ 'French (fr)': 'Salut' })
    expect(result?.dormantLanguages).toEqual([])
    expect(normalizeDefaultContent(target).changed).toBe(false)
  })

  it('B→B code match: a differently-named language with the same code maps onto the target key', () => {
    const target = doc({
      title: 'T',
      formId: 't',
      children: [],
      languages: ['English (en)', 'French (fr)'],
      defaultLanguage: 'English (en)',
    })
    const node = q('text', 'q1', undefined, { label: { 'Anglais (EN)': 'Bonjour' } })
    const payload = payloadOf({ nodes: [node], languages: ['Anglais (EN)'], defaultLanguage: 'Anglais (EN)' })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    const inserted = findNode(target, result?.insertedIds[0] ?? '')
    expect(inserted?.label).toEqual({ 'English (en)': 'Bonjour' })
    expect(normalizeDefaultContent(target).changed).toBe(false)
  })

  it('B→B name match: a code-less language matches a target language by name part alone', () => {
    const target = doc({
      title: 'T',
      formId: 't',
      children: [],
      languages: ['English (en)', 'French (fr)'],
      defaultLanguage: 'English (en)',
    })
    const node = q('text', 'q1', undefined, { label: { French: 'Salut' } })
    const payload = payloadOf({ nodes: [node], languages: ['English (en)', 'French'], defaultLanguage: 'English (en)' })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    const inserted = findNode(target, result?.insertedIds[0] ?? '')
    expect(inserted?.label).toEqual({ 'French (fr)': 'Salut' })
    expect(normalizeDefaultContent(target).changed).toBe(false)
  })

  it('B→B: an unmatched non-primary language stays dormant, not merged onto anything', () => {
    const target = doc({
      title: 'T',
      formId: 't',
      children: [],
      languages: ['English (en)', 'French (fr)'],
      defaultLanguage: 'English (en)',
    })
    const node = q('text', 'q1', undefined, {
      label: { 'English (en)': 'Hello', 'Deutsch (de)': 'Hallo' },
    })
    const payload = payloadOf({ nodes: [node], languages: ['English (en)', 'Deutsch (de)'], defaultLanguage: 'English (en)' })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    const inserted = findNode(target, result?.insertedIds[0] ?? '')
    expect(inserted?.label).toEqual({ 'English (en)': 'Hello', 'Deutsch (de)': 'Hallo' })
    expect(result?.dormantLanguages).toEqual(['Deutsch (de)'])
    expect(normalizeDefaultContent(target).changed).toBe(false)
  })

  it('sentinel debris from a mixed-shape source is dropped, never retained', () => {
    // A Shape-B payload whose text carries stray DEFAULT_LANG keys
    // (unresolved import conflicts in the source): retaining them would
    // seed the target with unassigned text.
    const target = doc({
      title: 'T',
      formId: 't',
      children: [],
      languages: ['English (en)'],
      defaultLanguage: 'English (en)',
    })
    const node = q('text', 'q1', undefined, {
      label: { 'English (en)': 'Hello', default: 'stray' },
    })
    const payload = payloadOf({ nodes: [node], languages: ['English (en)'], defaultLanguage: 'English (en)' })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    const inserted = findNode(target, result?.insertedIds[0] ?? '')
    expect(inserted?.label).toEqual({ 'English (en)': 'Hello' })
    expect(normalizeDefaultContent(target).changed).toBe(false)
  })
})

describe('mergeNodesIntoDoc — saveTo policy', () => {
  it('strips saveTo when the target declares no entities, and counts it', () => {
    const target = doc({ title: 'T', formId: 't', children: [] })
    const node = q('text', 'q1', 'Q1', { saveTo: 'some_property' })
    const payload = payloadOf({ nodes: [node] })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    const inserted = findNode(target, result?.insertedIds[0] ?? '')
    expect(inserted?.saveTo).toBeUndefined()
    expect(result?.strippedSaveTo).toBe(1)
  })

  it('keeps saveTo when the target declares entities', () => {
    const target = doc({
      title: 'T',
      formId: 't',
      children: [],
      entities: { datasetName: 'people' },
    })
    const node = q('text', 'q1', 'Q1', { saveTo: 'some_property' })
    const payload = payloadOf({ nodes: [node] })
    const result = mergeNodesIntoDoc(target, payload, ROOT)
    const inserted = findNode(target, result?.insertedIds[0] ?? '')
    expect(inserted?.saveTo).toBe('some_property')
    expect(result?.strippedSaveTo).toBe(0)
  })
})

describe('mergeNodesIntoDoc — payload immutability across repeated merges', () => {
  it('leaves the payload untouched and produces distinct fresh ids/names on a second merge', () => {
    const source = doc({ title: 'Source', formId: 's', children: [q('text', 'q1', 'Hello')] })
    const payload = buildNodesPayload(source, [source.children[0].id]) as NodesPayload
    const snapshot = JSON.parse(JSON.stringify(payload))

    const target = doc({ title: 'T', formId: 't', children: [] })
    const first = mergeNodesIntoDoc(target, payload, ROOT)
    const second = mergeNodesIntoDoc(target, payload, ROOT)

    expect(payload).toEqual(snapshot)
    expect(first?.insertedIds[0]).not.toBe(second?.insertedIds[0])
    const firstNode = findNode(target, first?.insertedIds[0] ?? '')
    const secondNode = findNode(target, second?.insertedIds[0] ?? '')
    expect(firstNode?.name).toBe('q1')
    expect(secondNode?.name).toBe('q1_2')
  })
})

describe('mergeNodesIntoDoc — property: post-merge invariants', () => {
  const buildTarget = (): FormDocument => {
    const built = doc({
      title: 'T',
      formId: 't',
      children: [
        q('text', 'existing_1', undefined, { label: { 'English (en)': 'One' } }),
        q('text', 'existing_2', undefined, { label: { 'English (en)': 'Two' } }),
      ],
      languages: ['English (en)', 'French (fr)'],
      defaultLanguage: 'English (en)',
    })
    // Built via a raw ChoiceList (not the choice() helper) so its label
    // lands under a named language key, not the DEFAULT_LANG sentinel — the
    // target is a Shape B doc and must have no sentinel debris of its own
    // before the invariant assertion below means anything.
    built.choiceLists.colors = { name: 'colors', choices: [{ name: 'red', label: { 'English (en)': 'Red' } }] }
    return built
  }

  it('every merge yields unique names, resolving listRefs, and the two-clean-shapes invariant', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.constantFrom('existing_1', 'q1', 'q2'),
            listRef: fc.constantFrom<string | undefined>('colors', 'other', undefined),
            lang: fc.constantFrom('English (en)', 'French (fr)', 'default', 'Deutsch (de)'),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        (specs) => {
          const target = buildTarget()
          const nodes = specs.map((s) => ({
            id: newId(),
            kind: 'question' as const,
            type: 'text',
            name: s.name,
            label: { [s.lang]: 'x' },
            bind: {},
            body: {},
            ...(s.listRef !== undefined ? { listRef: s.listRef } : {}),
          }))
          const choiceLists: Record<string, ChoiceList> = specs.some((s) => s.listRef === 'other')
            ? { other: { name: 'other', choices: [choice('a', 'A')] } }
            : {}
          const payload = payloadOf({ nodes, choiceLists, languages: ['English (en)'], defaultLanguage: 'English (en)' })

          const result = mergeNodesIntoDoc(target, payload, ROOT)
          expect(result).not.toBeNull()

          const names = flatten(target.children).map((n) => n.name)
          expect(new Set(names).size).toBe(names.length)
          expect(allNames(target).size).toBe(names.length)

          for (const id of result?.insertedIds ?? []) {
            const inserted = findNode(target, id)
            if (inserted?.kind === 'question' && inserted.listRef !== undefined) {
              expect(target.choiceLists[inserted.listRef]).toBeDefined()
            }
          }
          expect(normalizeDefaultContent(target).changed).toBe(false)
        }
      ),
      { numRuns: 40 }
    )
  })
})
