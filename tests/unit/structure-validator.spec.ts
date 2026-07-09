import { describe, expect, it } from 'vitest'

import { createNode, newDocument } from '@/core/model/factory'
import { insertNode } from '@/core/model/ops'
import { DEFAULT_LANG, type ContainerNode, type FormDocument } from '@/core/model/types'
import { validateDocument } from '@/core/validate'
import { validateStructure } from '@/core/validate/structure'

const addContainer = (doc: FormDocument, type: 'group' | 'repeat', parentId: string | null = null): ContainerNode => {
  const node = createNode(doc, type) as ContainerNode
  insertNode(doc, node, parentId)
  return node
}

const addQuestion = (doc: FormDocument, parentId: string | null = null): void => {
  insertNode(doc, createNode(doc, 'text'), parentId)
}

describe('validateStructure', () => {
  it('warns on an empty group, naming its label', () => {
    const doc = newDocument('T')
    const group = addContainer(doc, 'group')
    group.label = { [DEFAULT_LANG]: 'Household' }
    const issues = validateStructure(doc)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      severity: 'warning',
      code: 'structure.empty-container',
      message: 'Group "Household" has no questions yet — add a question or delete the group.',
      scope: { nodeId: group.id },
    })
  })

  it('uses repeat wording for empty repeats', () => {
    const doc = newDocument('T')
    const repeat = addContainer(doc, 'repeat')
    repeat.label = { [DEFAULT_LANG]: 'Visits' }
    const issues = validateStructure(doc)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toBe('Repeat "Visits" has no questions yet — add a question or delete the repeat.')
  })

  it('falls back to the field name when the container has no label', () => {
    const doc = newDocument('T')
    const group = addContainer(doc, 'group')
    group.label = undefined
    expect(validateStructure(doc)[0].message).toContain(`"${group.name}"`)
  })

  it('is silent for containers with children', () => {
    const doc = newDocument('T')
    const group = addContainer(doc, 'group')
    addQuestion(doc, group.id)
    expect(validateStructure(doc)).toEqual([])
  })

  it('flags only the innermost container when nested empties occur', () => {
    const doc = newDocument('T')
    const outer = addContainer(doc, 'group')
    const inner = addContainer(doc, 'repeat', outer.id)
    const issues = validateStructure(doc)
    expect(issues).toHaveLength(1)
    expect(issues[0].scope).toMatchObject({ nodeId: inner.id })
  })

  it('flags every empty container across the tree', () => {
    const doc = newDocument('T')
    const a = addContainer(doc, 'group')
    const b = addContainer(doc, 'repeat')
    const ids = validateStructure(doc).map((i) => 'nodeId' in i.scope ? i.scope.nodeId : undefined)
    expect(ids).toEqual([a.id, b.id])
  })

  it('is registered in validateDocument', () => {
    const doc = newDocument('T')
    addContainer(doc, 'group')
    expect(validateDocument(doc).map((i) => i.code)).toContain('structure.empty-container')
  })
})
