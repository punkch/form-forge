import { describe, expect, it } from 'vitest'

import { createNode, newDocument } from '../model/factory'
import { insertNode } from '../model/ops'
import type { FormDocument, QuestionNode } from '../model/types'
import { validateRefs } from './refs'

const addQuestion = (doc: FormDocument, type: string, name?: string): QuestionNode => {
  const node = createNode(doc, type) as QuestionNode
  if (name !== undefined) node.name = name
  insertNode(doc, node, null)
  return node
}

const attach = (doc: FormDocument, filename: string): void => {
  doc.attachments.push({ id: `att-${filename}`, filename, mediatype: 'text/csv', size: 10, role: 'csv' })
}

describe('validateRefs — itemset file attachments', () => {
  it('warns when a set itemsetFile has no matching attachment and clears once uploaded', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'select_one_from_file', 'district')
    q.itemsetFile = 'districts.csv'
    expect(validateRefs(doc).map((i) => i.code)).toContain('ref.missing-attachment')

    attach(doc, 'districts.csv')
    expect(validateRefs(doc)).toEqual([])
  })

  it('computes the csv-external effective default filename like the serializer', () => {
    const doc = newDocument('T')
    addQuestion(doc, 'csv-external', 'fuel_prices')
    // No itemsetFile set: the serializer will reference `${name}.csv`.
    const issues = validateRefs(doc)
    expect(issues.map((i) => i.code)).toContain('ref.missing-attachment')
    expect(issues[0].message).toContain('fuel_prices.csv')

    attach(doc, 'fuel_prices.csv')
    expect(validateRefs(doc)).toEqual([])
  })

  it('checks the explicit itemsetFile of a csv-external question, not the default', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'csv-external', 'fuel_prices')
    q.itemsetFile = 'prices.csv'
    attach(doc, 'fuel_prices.csv')
    const issues = validateRefs(doc)
    expect(issues.map((i) => i.code)).toContain('ref.missing-attachment')
    expect(issues[0].message).toContain('prices.csv')

    attach(doc, 'prices.csv')
    expect(validateRefs(doc)).toEqual([])
  })

  it('still errors ref.no-file for from-file selects without an itemsetFile', () => {
    const doc = newDocument('T')
    addQuestion(doc, 'select_one_from_file', 'district')
    const codes = validateRefs(doc).map((i) => i.code)
    expect(codes).toContain('ref.no-file')
    // No effective filename exists yet, so no missing-attachment noise on top.
    expect(codes).not.toContain('ref.missing-attachment')
  })
})
