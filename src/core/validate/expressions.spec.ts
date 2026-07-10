import { describe, expect, it } from 'vitest'

import { createNode, newDocument } from '../model/factory'
import { insertNode } from '../model/ops'
import type { FormDocument, QuestionNode } from '../model/types'
import { validateExpressions } from './expressions'
import { validateDocument } from './index'

const addQuestion = (doc: FormDocument, type: string, name: string): QuestionNode => {
  const node = createNode(doc, type) as QuestionNode
  node.name = name
  insertNode(doc, node, null)
  return node
}

const emptyValueIssues = (doc: FormDocument) =>
  validateExpressions(doc).filter((i) => i.code === 'expr.empty-condition-value')

describe('expr.empty-condition-value', () => {
  it("warns when a relevance condition compares against ''", () => {
    const doc = newDocument('T')
    addQuestion(doc, 'text', 'name')
    const q = addQuestion(doc, 'text', 'status')
    q.bind.relevant = "${name} = ''"
    const issues = emptyValueIssues(doc)
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      severity: 'warning',
      message: 'The relevant condition on "status" compares against an empty value.',
      scope: { nodeId: q.id },
    })
  })

  it('warns on empty selected() values, including inside nested groups', () => {
    const doc = newDocument('T')
    addQuestion(doc, 'integer', 'age')
    addQuestion(doc, 'select_one', 'district')
    const q = addQuestion(doc, 'text', 'status')
    q.bind.relevant = "${age} >= 18 and (selected(${district}, '') or ${age} = 21)"
    expect(emptyValueIssues(doc)).toHaveLength(1)
  })

  it('warns on constraint conditions too', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'text', 'name')
    q.bind.constraint = ". = ''"
    const issues = emptyValueIssues(doc)
    expect(issues).toHaveLength(1)
    expect(issues[0].message).toContain('constraint')
  })

  it("stays silent for the != '' \"is answered\" idiom", () => {
    const doc = newDocument('T')
    addQuestion(doc, 'text', 'consent')
    const q = addQuestion(doc, 'text', 'status')
    q.bind.relevant = "${consent} != ''"
    q.bind.constraint = ". != ''"
    expect(emptyValueIssues(doc)).toHaveLength(0)
  })

  it('stays silent for filled-in literals and zero', () => {
    const doc = newDocument('T')
    addQuestion(doc, 'integer', 'age')
    const q = addQuestion(doc, 'text', 'status')
    q.bind.relevant = '${age} = 0'
    q.bind.constraint = 'string-length(.) > 3'
    expect(emptyValueIssues(doc)).toHaveLength(0)
  })

  it('ignores raw expressions outside the structured grammar', () => {
    const doc = newDocument('T')
    addQuestion(doc, 'integer', 'age')
    const q = addQuestion(doc, 'text', 'status')
    q.bind.relevant = "string(${age}) = ''"
    expect(emptyValueIssues(doc)).toHaveLength(0)
  })

  it('ignores empty comparisons in non-condition sites (calculation)', () => {
    const doc = newDocument('T')
    addQuestion(doc, 'text', 'name')
    const q = addQuestion(doc, 'calculate', 'flag')
    q.bind.calculation = "${name} = ''"
    expect(emptyValueIssues(doc)).toHaveLength(0)
  })

  it('surfaces through validateDocument as a non-gating warning', () => {
    const doc = newDocument('T')
    addQuestion(doc, 'text', 'name')
    const q = addQuestion(doc, 'text', 'status')
    q.bind.relevant = "${name} = ''"
    const issues = validateDocument(doc)
    expect(issues.map((i) => i.code)).toContain('expr.empty-condition-value')
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])
  })
})
