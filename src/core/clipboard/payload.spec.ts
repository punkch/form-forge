import { describe, expect, it } from 'vitest'

import { choice, doc, q } from '../../../tests/helpers/doc-builders'
import {
  buildNodesPayload,
  CLIPBOARD_KIND,
  CLIPBOARD_VERSION,
  parseNodesPayload,
  serializeNodesPayload,
  tryParseClipboardText,
  type NodesPayload,
} from './payload'

describe('buildNodesPayload', () => {
  it('returns null for an empty or unknown selection', () => {
    const d = doc({ title: 'T', formId: 't', children: [q('text', 'q1', 'Q1')] })
    expect(buildNodesPayload(d, [])).toBeNull()
    expect(buildNodesPayload(d, ['nope'])).toBeNull()
  })

  it('snapshots the top-most nodes, detached from the live doc', () => {
    const node = q('text', 'q1', 'Q1')
    const d = doc({ title: 'T', formId: 't', children: [node] })
    const payload = buildNodesPayload(d, [node.id])
    expect(payload?.nodes).toEqual([node])
    // Mutating the source doc afterwards must not affect the payload — it's
    // a JSON snapshot, not a live reference.
    node.name = 'renamed'
    expect(payload?.nodes[0].name).toBe('q1')
  })

  it('carries only the choice lists reachable from the copied nodes', () => {
    const reached = q('select_one', 'fav', 'Favorite', { listRef: 'colors' })
    const unreached = q('select_one', 'other', 'Other', { listRef: 'sizes' })
    const d = doc({
      title: 'T',
      formId: 't',
      children: [reached, unreached],
      choiceLists: {
        colors: [choice('red', 'Red'), choice('blue', 'Blue')],
        sizes: [choice('s', 'Small')],
      },
    })
    const payload = buildNodesPayload(d, [reached.id])
    expect(Object.keys(payload?.choiceLists ?? {})).toEqual(['colors'])
  })

  it('records the implicit csv-external itemset filename among the attachment filenames', () => {
    const node = q('csv-external', 'lookup', 'Lookup')
    const d = doc({ title: 'T', formId: 't', children: [node] })
    const payload = buildNodesPayload(d, [node.id])
    expect(payload?.attachmentFilenames).toContain('lookup.csv')
  })

  it('carries the source document\'s language context', () => {
    const node = q('text', 'q1', 'Q1', { label: { 'English (en)': 'Q1' } })
    const d = doc({
      title: 'T',
      formId: 't',
      children: [node],
      languages: ['English (en)', 'French (fr)'],
      defaultLanguage: 'English (en)',
    })
    const payload = buildNodesPayload(d, [node.id])
    expect(payload?.languages).toEqual(['English (en)', 'French (fr)'])
    expect(payload?.defaultLanguage).toBe('English (en)')
  })

  it('threads sourceFormRecordId through when given', () => {
    const node = q('text', 'q1', 'Q1')
    const d = doc({ title: 'T', formId: 't', children: [node] })
    const payload = buildNodesPayload(d, [node.id], { sourceFormRecordId: 'rec-1' })
    expect(payload?.sourceFormRecordId).toBe('rec-1')
  })
})

describe('serializeNodesPayload / parseNodesPayload round-trip', () => {
  it('parses back to an equal payload', () => {
    const node = q('select_one', 'fav', 'Favorite', { listRef: 'colors' })
    const d = doc({
      title: 'T',
      formId: 't',
      children: [node],
      choiceLists: { colors: [choice('red', 'Red')] },
    })
    const payload = buildNodesPayload(d, [node.id])
    expect(payload).not.toBeNull()
    const text = serializeNodesPayload(payload as NodesPayload)
    const parsed = parseNodesPayload(JSON.parse(text))
    expect(parsed).toEqual(payload)
  })
})

describe('parseNodesPayload', () => {
  const valid = {
    kind: CLIPBOARD_KIND,
    version: CLIPBOARD_VERSION,
    nodes: [],
    choiceLists: {},
    languages: [],
    attachmentFilenames: [],
    copiedAt: 1,
  }

  it('rejects a payload from a newer app version', () => {
    expect(parseNodesPayload({ ...valid, version: 2 })).toBeNull()
  })

  it('rejects anything not shaped like a payload', () => {
    expect(parseNodesPayload(null)).toBeNull()
    expect(parseNodesPayload('hello')).toBeNull()
    expect(parseNodesPayload([])).toBeNull()
    expect(parseNodesPayload({ ...valid, kind: 'something-else' })).toBeNull()
    expect(parseNodesPayload({ ...valid, nodes: 'not-an-array' })).toBeNull()
    expect(parseNodesPayload({ ...valid, choiceLists: [] })).toBeNull()
    expect(parseNodesPayload({ ...valid, copiedAt: 'nope' })).toBeNull()
  })

  it('rejects a tagged payload whose elements are mangled (would crash the merge mid-mutate)', () => {
    // A node missing `bind`/`body`, a container without children, an unknown
    // kind, a non-string language, a mangled choice list — each must be
    // refused HERE: the merge runs inside mutate(), after the undo push.
    expect(parseNodesPayload({ ...valid, nodes: [{ id: 'a', name: 'a', kind: 'question', type: 'text', body: {} }] })).toBeNull()
    expect(parseNodesPayload({ ...valid, nodes: [{ id: 'a', name: 'a', kind: 'group', bind: {}, body: {} }] })).toBeNull()
    expect(parseNodesPayload({ ...valid, nodes: [{ id: 'a', name: 'a', kind: 'mystery', bind: {}, body: {} }] })).toBeNull()
    expect(parseNodesPayload({
      ...valid,
      nodes: [{ id: 'g', name: 'g', kind: 'group', bind: {}, body: {}, children: [{ id: 'x' }] }],
    })).toBeNull()
    expect(parseNodesPayload({ ...valid, languages: [42] })).toBeNull()
    expect(parseNodesPayload({ ...valid, attachmentFilenames: [null] })).toBeNull()
    expect(parseNodesPayload({ ...valid, choiceLists: { colors: { name: 'colors' } } })).toBeNull()
    expect(parseNodesPayload({ ...valid, choiceLists: { colors: { name: 'colors', choices: ['red'] } } })).toBeNull()
  })

  it('drops a blank optional sourceFormRecordId/defaultLanguage rather than passing it through', () => {
    const parsed = parseNodesPayload({ ...valid, sourceFormRecordId: '   ', defaultLanguage: 42 })
    expect(parsed?.sourceFormRecordId).toBeUndefined()
    expect(parsed?.defaultLanguage).toBeUndefined()
  })
})

describe('tryParseClipboardText', () => {
  it('round-trips a serialized payload', () => {
    const node = q('text', 'q1', 'Q1')
    const d = doc({ title: 'T', formId: 't', children: [node] })
    const payload = buildNodesPayload(d, [node.id]) as NodesPayload
    const parsed = tryParseClipboardText(serializeNodesPayload(payload))
    expect(parsed).toEqual(payload)
  })

  it('never throws on unrelated or malformed text', () => {
    expect(tryParseClipboardText('')).toBeNull()
    expect(tryParseClipboardText('just some copied text, not JSON at all')).toBeNull()
    expect(tryParseClipboardText('{"broken": ')).toBeNull()
    expect(tryParseClipboardText(`{"kind":"${CLIPBOARD_KIND}", not even valid json`)).toBeNull()
    expect(tryParseClipboardText('{"kind":"someone-elses-app"}')).toBeNull()
  })
})
