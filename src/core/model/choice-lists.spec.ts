import { describe, expect, it } from 'vitest'

import { choice, doc, group, q } from '../../../tests/helpers/doc-builders'
import {
  buildSimpleChoiceFilter,
  deleteChoiceList,
  ensureFilterColumn,
  extraColumns,
  listUsage,
  parseSimpleChoiceFilter,
  renameChoiceList,
} from './choice-lists'
import type { FormDocument, QuestionNode } from './types'

const sampleDoc = (): FormDocument =>
  doc({
    title: 'T',
    formId: 't',
    children: [
      q('select_one', 'state', 'State?', { listRef: 'states' }),
      group('g', 'Group', [
        q('select_one', 'birth_state', 'Birth state?', { listRef: 'states' }),
        q('select_multiple', 'colors', 'Colors?', { listRef: 'colors' }),
      ]),
      q('text', 'name', 'Name?'),
    ],
    choiceLists: {
      states: [choice('tx', 'Texas'), choice('wa', 'Washington')],
      colors: [choice('red', 'Red')],
      orphan: [choice('a', 'A')],
    },
  })

describe('listUsage', () => {
  it('maps every list to its bound questions in document order', () => {
    const usage = listUsage(sampleDoc())
    expect(usage.get('states')?.map((n) => n.name)).toEqual(['state', 'birth_state'])
    expect(usage.get('colors')?.map((n) => n.name)).toEqual(['colors'])
    expect(usage.get('orphan')).toEqual([])
  })
})

describe('renameChoiceList', () => {
  it('renames the list and updates every listRef', () => {
    const d = sampleDoc()
    expect(renameChoiceList(d, 'states', 'us_states')).toBe(true)
    expect(d.choiceLists.states).toBeUndefined()
    expect(d.choiceLists.us_states.name).toBe('us_states')
    const [state, groupNode] = d.children
    expect((state as QuestionNode).listRef).toBe('us_states')
    expect((groupNode as { children: QuestionNode[] }).children[0].listRef).toBe('us_states')
    expect((groupNode as { children: QuestionNode[] }).children[1].listRef).toBe('colors')
  })

  it('rejects unknown, empty and colliding names', () => {
    const d = sampleDoc()
    expect(renameChoiceList(d, 'nope', 'x')).toBe(false)
    expect(renameChoiceList(d, 'states', '')).toBe(false)
    expect(renameChoiceList(d, 'states', 'states')).toBe(false)
    expect(renameChoiceList(d, 'states', 'colors')).toBe(false)
    expect((d.children[0] as QuestionNode).listRef).toBe('states')
  })
})

describe('deleteChoiceList', () => {
  it('removes the list and clears refs of its users', () => {
    const d = sampleDoc()
    expect(deleteChoiceList(d, 'states')).toBe(true)
    expect(d.choiceLists.states).toBeUndefined()
    expect((d.children[0] as QuestionNode).listRef).toBeUndefined()
  })

  it('returns false for unknown lists', () => {
    expect(deleteChoiceList(sampleDoc(), 'nope')).toBe(false)
  })
})

describe('extraColumns + ensureFilterColumn', () => {
  it('reads declared order first, then stragglers on choices', () => {
    const d = sampleDoc()
    d.choiceLists.states.extraColumnOrder = ['region']
    d.choiceLists.states.choices[1].extras = { region: 'west', climate: 'wet' }
    expect(extraColumns(d.choiceLists.states)).toEqual(['region', 'climate'])
  })

  it('adds the column to the order and every choice exactly once', () => {
    const d = sampleDoc()
    const list = d.choiceLists.states
    list.choices[0].extras = { region: 'south' }
    ensureFilterColumn(list, 'region')
    ensureFilterColumn(list, 'region')
    expect(list.extraColumnOrder).toEqual(['region'])
    expect(list.choices[0].extras).toEqual({ region: 'south' })
    expect(list.choices[1].extras).toEqual({ region: '' })
  })
})

describe('simple choice_filter parse/build', () => {
  it('round-trips the simple pattern', () => {
    expect(parseSimpleChoiceFilter('state=${state}')).toEqual({ column: 'state', parentField: 'state' })
    expect(parseSimpleChoiceFilter(' region = ${birth_state} ')).toEqual({ column: 'region', parentField: 'birth_state' })
    expect(buildSimpleChoiceFilter('region', 'birth_state')).toBe('region=${birth_state}')
  })

  it('rejects anything more complex', () => {
    expect(parseSimpleChoiceFilter(undefined)).toBeNull()
    expect(parseSimpleChoiceFilter('')).toBeNull()
    expect(parseSimpleChoiceFilter('state=${state} and county=${county}')).toBeNull()
    expect(parseSimpleChoiceFilter('name-filter=${a} or true()')).toBeNull()
    expect(parseSimpleChoiceFilter('state!=${state}')).toBeNull()
  })
})
