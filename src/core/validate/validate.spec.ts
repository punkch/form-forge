import { describe, expect, it } from 'vitest'

import { createNode, newChoiceList, newDocument } from '../model/factory'
import { insertNode } from '../model/ops'
import { DEFAULT_LANG, type FormDocument, type QuestionNode } from '../model/types'
import { validateDocument } from './index'
import { validateChoices } from './choices'
import { validateEntities } from './entities'
import { validateExpressions } from './expressions'
import { validateRefs } from './refs'
import { validateTranslations } from './translations'

const addQuestion = (doc: FormDocument, type: string, name: string): QuestionNode => {
  const node = createNode(doc, type) as QuestionNode
  node.name = name
  insertNode(doc, node, null)
  return node
}

describe('validateExpressions', () => {
  it('accepts well-formed expressions with resolvable refs', () => {
    const doc = newDocument('T')
    addQuestion(doc, 'integer', 'age')
    const q = addQuestion(doc, 'text', 'status')
    q.bind.relevant = '${age} >= 18'
    q.bind.constraint = 'string-length(.) > 3'
    expect(validateExpressions(doc)).toEqual([])
  })

  it('flags unknown refs, unbalanced parens and unterminated strings', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'text', 'status')
    q.bind.relevant = '${ghost} = 1'
    q.bind.constraint = 'count(. > 2'
    q.bind.calculation = "concat('open"
    const codes = validateExpressions(doc).map((i) => i.code)
    expect(codes).toContain('expr.unknown-ref')
    expect(codes).toContain('expr.unbalanced')
    expect(codes).toContain('expr.unterminated-string')
  })

  it('warns on constraints referencing their own field', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'integer', 'age')
    q.bind.constraint = '${age} > 0'
    const issues = validateExpressions(doc)
    expect(issues[0]).toMatchObject({ code: 'expr.self-ref', severity: 'warning' })
  })

  it('validates choice_filter and repeat_count expressions', () => {
    const doc = newDocument('T')
    const select = addQuestion(doc, 'select_one', 'district')
    select.choiceFilter = 'state=${missing_state}'
    const codes = validateExpressions(doc).map((i) => i.code)
    expect(codes).toContain('expr.unknown-ref')
  })
})

describe('validateRefs', () => {
  it('flags selects without a valid list', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'select_one', 'q1')
    q.listRef = 'nope'
    expect(validateRefs(doc).map((i) => i.code)).toContain('ref.unknown-list')
    q.listRef = undefined
    expect(validateRefs(doc).map((i) => i.code)).toContain('ref.no-list')
  })

  it('warns on missing attachments and errors on save_to without entities', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'select_one_from_file', 'q1')
    q.itemsetFile = 'districts.csv'
    q.saveTo = 'district'
    const codes = validateRefs(doc).map((i) => i.code)
    expect(codes).toContain('ref.missing-attachment')
    expect(codes).toContain('entities.saveto-without-declaration')

    doc.attachments.push({ id: 'a1', filename: 'districts.csv', mediatype: 'text/csv', size: 10, role: 'csv' })
    doc.entities = { datasetName: 'districts' }
    expect(validateRefs(doc)).toEqual([])
  })

  it('warns on unknown question types (preserved but not editable)', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'text', 'q1')
    q.type = 'hyperspace'
    expect(validateRefs(doc).map((i) => i.code)).toContain('ref.unknown-type')
  })
})

describe('validateChoices', () => {
  it('flags duplicates unless allow_choice_duplicates', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'select_one', 'q1')
    const list = doc.choiceLists[q.listRef as string]
    list.choices[1].name = list.choices[0].name
    expect(validateChoices(doc).map((i) => i.code)).toContain('choice.duplicate')
    doc.settings.allowChoiceDuplicates = true
    expect(validateChoices(doc).map((i) => i.code)).not.toContain('choice.duplicate')
  })

  it('flags empty names, empty used lists and unused lists', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'select_one', 'q1')
    const list = doc.choiceLists[q.listRef as string]
    list.choices = [{ name: '' }]
    const unused = newChoiceList(doc, 'orphan')
    const codes = validateChoices(doc).map((i) => i.code)
    expect(codes).toContain('choice.empty-name')
    expect(codes).toContain('choice.unused-list')
    expect(unused.name).toBe('orphan')
  })
})

describe('validateTranslations', () => {
  it('is silent without declared languages', () => {
    const doc = newDocument('T')
    addQuestion(doc, 'text', 'q1')
    expect(validateTranslations(doc)).toEqual([])
  })

  it('warns on partially translated labels and unknown default language', () => {
    const doc = newDocument('T')
    doc.languages = ['English (en)', 'French (fr)']
    doc.settings.defaultLanguage = 'German (de)'
    const q = addQuestion(doc, 'text', 'q1')
    q.label = { 'English (en)': 'Name?' }
    const issues = validateTranslations(doc)
    expect(issues.map((i) => i.code)).toContain('i18n.unknown-default-language')
    const missing = issues.filter((i) => i.code === 'i18n.missing-translation')
    expect(missing).toHaveLength(1)
    expect(missing[0].scope).toMatchObject({ language: 'French (fr)' })
  })
})

describe('validateEntities', () => {
  it('checks update/create consistency', () => {
    const doc = newDocument('T')
    doc.entities = { datasetName: 'households', updateIf: 'true()' }
    expect(validateEntities(doc).map((i) => i.code)).toContain('entities.update-without-id')
    doc.entities = { datasetName: 'households', createIf: 'true()' }
    expect(validateEntities(doc).map((i) => i.code)).toContain('entities.create-without-label')
    doc.entities = { datasetName: 'households', createIf: 'true()', label: '${name}' }
    expect(validateEntities(doc)).toEqual([])
  })
})

describe('validateDocument', () => {
  it('composes all validators', () => {
    const doc = newDocument('T')
    const a = addQuestion(doc, 'text', 'dup')
    const b = addQuestion(doc, 'integer', 'dup')
    b.bind.relevant = '${nope} = 1'
    const codes = validateDocument(doc).map((i) => i.code)
    expect(codes).toContain('name.duplicate')
    expect(codes).toContain('expr.unknown-ref')
    expect(a.id).toBeTruthy()
  })

  it('returns no errors for a healthy document', () => {
    const doc = newDocument('T')
    addQuestion(doc, 'text', 'name')
    const sel = addQuestion(doc, 'select_one', 'district')
    sel.label = { [DEFAULT_LANG]: 'District' }
    const errors = validateDocument(doc).filter((i) => i.severity === 'error')
    expect(errors).toEqual([])
  })
})
