import { describe, expect, it } from 'vitest'

import type { QuestionNode } from '../model/types'

import { CATEGORY_LABELS, CATEGORY_ORDER, effectiveItemsetFile, getAllQuestionTypes, questionTypeRegistry } from './question-types'

/** The full XLSForm question-type list this product supports. */
const EXPECTED_TYPES = [
  'text', 'integer', 'decimal', 'range', 'note', 'calculate', 'acknowledge',
  'select_one', 'select_multiple', 'select_one_from_file', 'select_multiple_from_file', 'rank',
  'group', 'repeat',
  'date', 'time', 'datetime',
  'geopoint', 'geotrace', 'geoshape', 'start-geopoint',
  'image', 'audio', 'background-audio', 'video', 'file', 'barcode',
  'csv-external',
  'start', 'end', 'today', 'deviceid', 'username', 'phonenumber', 'email', 'audit',
]

describe('question type registry', () => {
  it('covers the full XLSForm type list', () => {
    for (const type of EXPECTED_TYPES) {
      expect(questionTypeRegistry[type], `missing type: ${type}`).toBeDefined()
    }
    expect(Object.keys(questionTypeRegistry).sort()).toEqual([...EXPECTED_TYPES].sort())
  })

  it('every definition is internally consistent', () => {
    for (const def of getAllQuestionTypes()) {
      expect(def.type).toBeTruthy()
      expect(questionTypeRegistry[def.type]).toBe(def)
      expect(def.title).toBeTruthy()
      expect(def.description).toBeTruthy()
      expect(def.icon).toMatch(/^pi pi-/)
      expect(CATEGORY_ORDER).toContain(def.category)
      expect(def.xform).toBeDefined()
      if (def.isContainer) {
        expect(def.containerKind).toBeDefined()
      } else if (def.type !== 'csv-external') {
        // Every non-container, non-attachment type must map to a bind type.
        expect(def.xform.bindType, `${def.type} needs a bindType`).toBeDefined()
      }
      if (def.xform.bodyElement === 'upload') {
        expect(def.xform.mediatype, `${def.type} upload needs a mediatype`).toBeDefined()
      }
      for (const param of def.parameters ?? []) {
        expect(param.name).toBeTruthy()
        expect(['string', 'number', 'boolean']).toContain(param.type)
      }
      for (const appearance of def.appearances ?? []) {
        expect(appearance.name).toBeTruthy()
        expect(appearance.collectSupported || appearance.enketoSupported).toBe(true)
      }
    }
  })

  it('metadata preload types carry jr:preload mappings', () => {
    const preloaded = ['start', 'end', 'today', 'deviceid', 'username', 'phonenumber', 'email']
    for (const type of preloaded) {
      expect(questionTypeRegistry[type].xform.preload, `${type} needs a preload`).toBeDefined()
      expect(questionTypeRegistry[type].xform.bodyElement).toBeNull()
    }
  })

  it('every category has a label', () => {
    for (const category of CATEGORY_ORDER) {
      expect(CATEGORY_LABELS[category]).toBeTruthy()
    }
  })
})

describe('effectiveItemsetFile', () => {
  const q = (over: Partial<QuestionNode>): QuestionNode => ({
    id: 'q1', name: 'q1', kind: 'question', type: 'text', bind: {}, body: {}, ...over,
  })

  it('returns the explicit itemsetFile for from_file questions', () => {
    expect(effectiveItemsetFile(q({ type: 'select_one_from_file', name: 'sites', itemsetFile: 'districts.csv' })))
      .toBe('districts.csv')
  })

  it('defaults csv-external to `${name}.csv` when itemsetFile is unset', () => {
    expect(effectiveItemsetFile(q({ type: 'csv-external', name: 'fuel' }))).toBe('fuel.csv')
  })

  it('lets an explicit itemsetFile win over the csv-external default', () => {
    expect(effectiveItemsetFile(q({ type: 'csv-external', name: 'fuel', itemsetFile: 'stock.csv' })))
      .toBe('stock.csv')
  })

  it('is undefined for non-file types with no itemsetFile', () => {
    expect(effectiveItemsetFile(q({ type: 'text', name: 'q1' }))).toBeUndefined()
    expect(effectiveItemsetFile(q({ type: 'select_one_from_file', name: 'sites' }))).toBeUndefined()
  })
})
