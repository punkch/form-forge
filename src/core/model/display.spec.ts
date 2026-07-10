import { describe, expect, it } from 'vitest'

import { documentPreviewLabels } from './display'
import { createNode, newDocument } from './factory'
import { insertNode } from './ops'
import { DEFAULT_LANG, type FormDocument, type GroupNode } from './types'

/**
 * Builds: root → [ group → [g0, g1], root0 ]. Preorder question walk is
 * [g0, g1, root0], which is the order documentPreviewLabels must follow.
 */
const buildDoc = (groupLabels: Array<string | undefined>, rootLabel: string | undefined): FormDocument => {
  const doc = newDocument('Preview')
  const group = createNode(doc, 'group') as GroupNode
  insertNode(doc, group, null)
  for (const label of groupLabels) {
    const q = createNode(doc, 'text')
    // createNode seeds a default label; override it so `undefined` really is
    // an unlabelled question.
    q.label = label === undefined ? undefined : { [DEFAULT_LANG]: label }
    insertNode(doc, q, group.id)
  }
  const rootQ = createNode(doc, 'text')
  rootQ.label = rootLabel === undefined ? undefined : { [DEFAULT_LANG]: rootLabel }
  insertNode(doc, rootQ, null)
  return doc
}

describe('documentPreviewLabels', () => {
  it('walks the tree in order and stops at the limit', () => {
    const doc = buildDoc(['Region', 'Village'], 'Notes')
    expect(documentPreviewLabels(doc, 5)).toEqual(['Region', 'Village', 'Notes'])
    expect(documentPreviewLabels(doc, 2)).toEqual(['Region', 'Village'])
  })

  it('skips questions with no display label', () => {
    const doc = buildDoc(['Region', undefined], 'Notes')
    expect(documentPreviewLabels(doc, 5)).toEqual(['Region', 'Notes'])
  })

  it('returns an empty list for a doc with no labelled questions', () => {
    expect(documentPreviewLabels(newDocument('Empty'), 5)).toEqual([])
  })
})
