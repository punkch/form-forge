import { describe, expect, it } from 'vitest'

import { createNode, newDocument } from '../model/factory'
import { insertNode } from '../model/ops'
import type { FormDocument, QuestionNode } from '../model/types'
import { filterColumnCandidates, validateDatasets } from './datasets'
import { validateDocument } from './index'

const addQuestion = (doc: FormDocument, type: string, file?: string): QuestionNode => {
  const node = createNode(doc, type) as QuestionNode
  node.itemsetFile = file
  insertNode(doc, node, null)
  return node
}

const columns = (entries: Record<string, readonly string[] | null>): Map<string, readonly string[] | null> =>
  new Map(Object.entries(entries))

describe('validateDatasets — value/label parameters', () => {
  it('warns when an explicit value parameter is not a column of the file', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'select_one_from_file', 'villages.csv')
    q.body.parameters = { value: 'nmae', label: 'label' }

    const issues = validateDatasets(doc, columns({ 'villages.csv': ['name', 'label', 'district'] }))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      severity: 'warning',
      code: 'dataset.unknown-column',
      scope: { nodeId: q.id },
    })
    expect(issues[0].message).toContain('nmae')
  })

  it('checks the per-format default columns when parameters are omitted', () => {
    const doc = newDocument('T')
    addQuestion(doc, 'select_one_from_file', 'villages.csv')

    // CSV defaults are name/label: a file without them warns for both.
    const issues = validateDatasets(doc, columns({ 'villages.csv': ['code', 'title'] }))
    expect(issues.map((i) => i.code)).toEqual(['dataset.unknown-column', 'dataset.unknown-column'])
    expect(issues[0].message).toContain('"name"')
    expect(issues[1].message).toContain('"label"')

    // ...and stays silent when the defaults exist.
    expect(validateDatasets(doc, columns({ 'villages.csv': ['name', 'label'] }))).toEqual([])
  })

  it('uses geojson defaults (id/title) for .geojson files', () => {
    const doc = newDocument('T')
    addQuestion(doc, 'select_multiple_from_file', 'sites.geojson')

    expect(validateDatasets(doc, columns({ 'sites.geojson': ['id', 'title', 'geometry'] }))).toEqual([])
    const issues = validateDatasets(doc, columns({ 'sites.geojson': ['name', 'label'] }))
    expect(issues).toHaveLength(2)
    expect(issues[0].message).toContain('"id"')
  })

  it('stays silent for unparsed (null), absent and empty column sets', () => {
    const doc = newDocument('T')
    addQuestion(doc, 'select_one_from_file', 'villages.csv')

    expect(validateDatasets(doc, columns({ 'villages.csv': null }))).toEqual([])
    expect(validateDatasets(doc, columns({}))).toEqual([])
    expect(validateDatasets(doc, columns({ 'villages.csv': [] }))).toEqual([])
  })

  it('ignores csv-external questions (no value/label parameters)', () => {
    const doc = newDocument('T')
    addQuestion(doc, 'csv-external', 'fuel.csv')
    expect(validateDatasets(doc, columns({ 'fuel.csv': ['code', 'price'] }))).toEqual([])
  })

  it('ignores xml files even when columns were somehow provided', () => {
    const doc = newDocument('T')
    addQuestion(doc, 'select_one_from_file', 'lookup.xml')
    expect(validateDatasets(doc, columns({ 'lookup.xml': ['name'] }))).toEqual([])
  })
})

describe('validateDatasets — choice_filter columns', () => {
  it('reports unknown filter columns as info issues', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'select_one_from_file', 'villages.csv')
    q.choiceFilter = 'district=${d} and regoin=${r}'

    const issues = validateDatasets(doc, columns({ 'villages.csv': ['name', 'label', 'district', 'region'] }))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ severity: 'info', code: 'dataset.filter-unknown-column' })
    expect(issues[0].message).toContain('regoin')
  })

  it('produces no false positives for refs, literals, functions and operators', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'select_one_from_file', 'villages.csv')
    q.choiceFilter = "district=${district} or selected('name x', ../path) and not(true()) mod 2"

    expect(validateDatasets(doc, columns({ 'villages.csv': ['name', 'label', 'district'] }))).toEqual([])
  })
})

describe('filterColumnCandidates', () => {
  it('extracts bare comparison names only', () => {
    expect(filterColumnCandidates('state=${state} and county-id=${c}').sort())
      .toEqual(['county-id', 'state'])
    expect(filterColumnCandidates("contains('state literal', name)")).toEqual(['name'])
    expect(filterColumnCandidates('position(..) > 2')).toEqual([])
  })
})

describe('validateDocument context wiring', () => {
  it('runs dataset validation only when the context provides columns', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'select_one_from_file', 'villages.csv')
    q.body.parameters = { value: 'wrong' }
    doc.attachments.push({ id: 'a1', filename: 'villages.csv', mediatype: 'text/csv', size: 1, role: 'csv' })

    expect(validateDocument(doc).some((i) => i.code === 'dataset.unknown-column')).toBe(false)
    const issues = validateDocument(doc, { datasetColumns: columns({ 'villages.csv': ['name', 'label'] }) })
    expect(issues.some((i) => i.code === 'dataset.unknown-column')).toBe(true)
  })
})
