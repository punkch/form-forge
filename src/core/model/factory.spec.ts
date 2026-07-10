import { describe, expect, it } from 'vitest'

import { DEFAULT_LANG, isContainer, type ContainerNode, type FormDocument } from './types'
import { createNode, instantiateTemplate, newChoiceList, newDocument } from './factory'
import { flatten, insertNode } from './ops'

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

describe('instantiateTemplate', () => {
  /** Template with a nested group→repeat→question chain plus attachments. */
  const template = (): FormDocument => {
    const doc = newDocument('Template Source')
    const group = createNode(doc, 'group') as ContainerNode
    insertNode(doc, group, null)
    const repeat = createNode(doc, 'repeat') as ContainerNode
    insertNode(doc, repeat, group.id)
    insertNode(doc, createNode(doc, 'text'), repeat.id)
    insertNode(doc, createNode(doc, 'select_one'), null)
    doc.attachments.push({ id: 'a1', filename: 'x.csv', mediatype: 'text/csv', size: 1, role: 'csv' })
    return doc
  }

  it('mints fresh ids for every node at every depth', () => {
    const source = template()
    const copy = instantiateTemplate(source, 'My Survey')
    const sourceIds = new Set(flatten(source.children).map((n) => n.id))
    const copyNodes = flatten(copy.children)
    expect(copyNodes).toHaveLength(4)
    for (const node of copyNodes) expect(sourceIds.has(node.id)).toBe(false)
    expect(new Set(copyNodes.map((n) => n.id)).size).toBe(copyNodes.length)
  })

  it('is independent from the source document', () => {
    const source = template()
    const copy = instantiateTemplate(source, 'My Survey')
    const copyChild = copy.children[0]
    if (isContainer(copyChild)) copyChild.children.length = 0
    copy.choiceLists.choices.choices[0].name = 'mutated'
    expect(flatten(source.children)).toHaveLength(4)
    expect(source.choiceLists.choices.choices[0].name).toBe('option_1')
  })

  it('resets title, form id, version and attachments', () => {
    const source = template()
    source.settings.version = 'template-version'
    const copy = instantiateTemplate(source, 'Water Survey 2026!')
    expect(copy.settings.formTitle).toBe('Water Survey 2026!')
    expect(copy.settings.formId).toBe('water_survey_2026')
    expect(copy.settings.version).toMatch(/^\d{12}$/)
    expect(copy.attachments).toEqual([])
    // Source keeps its own identity and attachment refs.
    expect(source.settings.formTitle).toBe('Template Source')
    expect(source.attachments).toHaveLength(1)
  })

  it('keeps names, labels and non-identity settings', () => {
    const source = template()
    source.settings.defaultLanguage = 'English (en)'
    const copy = instantiateTemplate(source, 'T')
    expect(flatten(copy.children).map((n) => n.name)).toEqual(flatten(source.children).map((n) => n.name))
    expect(copy.settings.defaultLanguage).toBe('English (en)')
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
