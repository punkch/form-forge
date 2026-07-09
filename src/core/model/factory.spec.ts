import { describe, expect, it } from 'vitest'

import { DEFAULT_LANG } from './types'
import { createNode, newChoiceList, newDocument } from './factory'
import { insertNode } from './ops'

describe('newDocument', () => {
  it('slugifies the title into a form id', () => {
    const doc = newDocument('Household Survey 2026!')
    expect(doc.settings.formId).toBe('household_survey_2026')
    expect(doc.settings.formTitle).toBe('Household Survey 2026!')
    expect(doc.settings.version).toMatch(/^\d{12}$/)
    expect(doc.schemaVersion).toBe(1)
  })

  it('never produces an empty or digit-leading form id', () => {
    expect(newDocument('!!!').settings.formId).toBe('form')
    expect(newDocument('2026 census').settings.formId).toBe('_2026_census')
  })
})

describe('createNode', () => {
  it('creates questions with default labels and unique names', () => {
    const doc = newDocument('T')
    const a = createNode(doc, 'text')
    insertNode(doc, a, null)
    const b = createNode(doc, 'text')
    expect(a.kind).toBe('question')
    expect(a.label?.[DEFAULT_LANG]).toBeTruthy()
    expect(b.name).not.toBe(a.name)
  })

  it('creates containers with children arrays', () => {
    const doc = newDocument('T')
    const group = createNode(doc, 'group')
    const repeat = createNode(doc, 'repeat')
    expect(group.kind).toBe('group')
    expect(repeat.kind).toBe('repeat')
    expect('children' in group && group.children).toEqual([])
  })

  it('binds a fresh choice list to select questions', () => {
    const doc = newDocument('T')
    const select = createNode(doc, 'select_one')
    expect(select.kind).toBe('question')
    if (select.kind === 'question') {
      expect(select.listRef).toBeDefined()
      expect(doc.choiceLists[select.listRef as string].choices).toHaveLength(3)
    }
  })

  it('seeds required parameter defaults (range start/end)', () => {
    const doc = newDocument('T')
    const range = createNode(doc, 'range')
    expect(range.body.parameters).toMatchObject({ start: '1', end: '10' })
  })

  it('names metadata questions after their type without a label', () => {
    const doc = newDocument('T')
    const start = createNode(doc, 'start')
    expect(start.kind === 'question' && start.name).toBe('start')
    expect(start.label).toBeUndefined()
  })
})

describe('newChoiceList', () => {
  it('uniquifies list names', () => {
    const doc = newDocument('T')
    const a = newChoiceList(doc)
    const b = newChoiceList(doc)
    expect(a.name).not.toBe(b.name)
    expect(Object.keys(doc.choiceLists)).toHaveLength(2)
  })
})
