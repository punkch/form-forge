import { describe, expect, it } from 'vitest'

import {
  holdsUserValue,
  logicFieldOptions,
  nearestPrecedingFieldOption,
} from '@/components/logic/field-options'
import { createNode, newDocument } from '@/core/model/factory'
import { insertNode } from '@/core/model/ops'
import type { FormDocument, FormNode } from '@/core/model/types'

const add = (
  doc: FormDocument,
  type: string,
  name: string,
  parentId: string | null = null
): FormNode => {
  const node = createNode(doc, type)
  node.name = name
  insertNode(doc, node, parentId)
  return node
}

describe('holdsUserValue', () => {
  it('rejects readonly display types (note)', () => {
    expect(holdsUserValue('note')).toBe(false)
  })

  it('keeps input, select, computed and metadata types', () => {
    for (const type of ['text', 'integer', 'select_one', 'calculate', 'start']) {
      expect(holdsUserValue(type), type).toBe(true)
    }
  })

  it('assumes unknown types hold a value (imported forms stay referenceable)', () => {
    expect(holdsUserValue('hyperspace')).toBe(true)
  })
})

describe('logicFieldOptions', () => {
  it('drops notes but keeps calculates, in document order', () => {
    const doc = newDocument('T')
    add(doc, 'note', 'intro')
    add(doc, 'text', 'name')
    add(doc, 'calculate', 'score')
    expect(logicFieldOptions(doc).map((o) => o.name)).toEqual(['name', 'score'])
  })

  it('still excludes the node being edited', () => {
    const doc = newDocument('T')
    const name = add(doc, 'text', 'name')
    add(doc, 'integer', 'age')
    expect(logicFieldOptions(doc, name.id).map((o) => o.name)).toEqual(['age'])
  })
})

describe('nearestPrecedingFieldOption', () => {
  it('picks the closest preceding answerable question, skipping notes', () => {
    const doc = newDocument('T')
    add(doc, 'text', 'first')
    add(doc, 'integer', 'age')
    add(doc, 'note', 'hint')
    const target = add(doc, 'text', 'target')
    expect(nearestPrecedingFieldOption(doc, target.id)).toMatchObject({ name: 'age', bindType: 'int' })
  })

  it('sees questions inside preceding groups (flattened document order)', () => {
    const doc = newDocument('T')
    const group = add(doc, 'group', 'g')
    add(doc, 'text', 'inner', group.id)
    const target = add(doc, 'text', 'target')
    expect(nearestPrecedingFieldOption(doc, target.id)?.name).toBe('inner')
  })

  it('falls back to the first answerable field when nothing precedes', () => {
    const doc = newDocument('T')
    add(doc, 'note', 'intro')
    const target = add(doc, 'text', 'target')
    add(doc, 'integer', 'after')
    expect(nearestPrecedingFieldOption(doc, target.id)?.name).toBe('after')
  })

  it('returns undefined when no other question holds a value', () => {
    const doc = newDocument('T')
    add(doc, 'note', 'intro')
    const target = add(doc, 'text', 'target')
    expect(nearestPrecedingFieldOption(doc, target.id)).toBeUndefined()
  })
})
