import { describe, expect, it } from 'vitest'

import { createNode, newDocument } from './factory'
import { insertNode } from './ops'
import type { Choice, FormDocument, QuestionNode } from './types'
import {
  collectAttachmentReferences,
  firstFreeAttachmentName,
  renameAttachmentRefs,
  scanAttachmentReferences,
} from './rename-attachment'

const addQuestion = (doc: FormDocument, type: string, name?: string): QuestionNode => {
  const node = createNode(doc, type) as QuestionNode
  if (name !== undefined) node.name = name
  insertNode(doc, node, null)
  return node
}

const attach = (doc: FormDocument, filename: string): void => {
  doc.attachments.push({ id: `att-${filename}`, filename, mediatype: 'text/csv', size: 10, role: 'csv' })
}

describe('collectAttachmentReferences / scanAttachmentReferences', () => {
  it('is zero for an unreferenced file', () => {
    const doc = newDocument('T')
    attach(doc, 'unused.csv')
    expect(scanAttachmentReferences(doc, 'unused.csv').count).toBe(0)
    expect(collectAttachmentReferences(doc).has('unused.csv')).toBe(false)
  })

  it('counts an explicit itemsetFile match', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'select_one_from_file', 'district')
    q.itemsetFile = 'districts.csv'
    expect(scanAttachmentReferences(doc, 'districts.csv').count).toBe(1)
  })

  it('counts the implicit csv-external default when itemsetFile is unset', () => {
    const doc = newDocument('T')
    addQuestion(doc, 'csv-external', 'fuel_prices')
    expect(scanAttachmentReferences(doc, 'fuel_prices.csv').count).toBe(1)
  })

  it('counts question-label media in one language and choice-label media', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'text', 'q1')
    q.media = { image: { default: 'photo.png' } }
    doc.choiceLists.colors = {
      name: 'colors',
      choices: [
        { name: 'red', media: { image: { default: 'red.png' } } } satisfies Choice,
      ],
    }
    expect(scanAttachmentReferences(doc, 'photo.png').count).toBe(1)
    expect(scanAttachmentReferences(doc, 'red.png').count).toBe(1)
  })

  it('counts each language occurrence separately, not once per media slot', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'text', 'q1')
    q.media = { image: { default: 'shared.png', 'French (fr)': 'shared.png' } }
    expect(scanAttachmentReferences(doc, 'shared.png').count).toBe(2)
  })

  it('includes referenced-but-not-uploaded filenames and excludes unreferenced attachments', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'select_one_from_file', 'district')
    q.itemsetFile = 'districts.csv' // referenced, never uploaded
    attach(doc, 'unrelated.csv') // uploaded, never referenced
    const counts = collectAttachmentReferences(doc)
    expect(counts.has('districts.csv')).toBe(true)
    expect(counts.has('unrelated.csv')).toBe(false)
  })
})

describe('renameAttachmentRefs', () => {
  it('renames the ref filename', () => {
    const doc = newDocument('T')
    attach(doc, 'sites.csv')
    const outcome = renameAttachmentRefs(doc, 'sites.csv', 'villages.csv')
    expect(outcome).toEqual({ ok: true, referencesUpdated: 0 })
    expect(doc.attachments[0].filename).toBe('villages.csv')
  })

  it('rewrites an explicit itemsetFile', () => {
    const doc = newDocument('T')
    attach(doc, 'sites.csv')
    const q = addQuestion(doc, 'select_one_from_file', 'district')
    q.itemsetFile = 'sites.csv'
    const outcome = renameAttachmentRefs(doc, 'sites.csv', 'villages.csv')
    expect(outcome).toEqual({ ok: true, referencesUpdated: 1 })
    expect(q.itemsetFile).toBe('villages.csv')
  })

  it('materializes an implicit csv-external default into an explicit itemsetFile under the new name', () => {
    const doc = newDocument('T')
    const q = addQuestion(doc, 'csv-external', 'fuel_prices')
    attach(doc, 'fuel_prices.csv')
    expect(q.itemsetFile).toBeUndefined()

    const outcome = renameAttachmentRefs(doc, 'fuel_prices.csv', 'prices.csv')

    expect(outcome).toEqual({ ok: true, referencesUpdated: 1 })
    expect(q.itemsetFile).toBe('prices.csv')
  })

  it('rewrites question-label and choice-label media across multiple languages', () => {
    const doc = newDocument('T')
    attach(doc, 'photo.png')
    const q = addQuestion(doc, 'text', 'q1')
    q.media = { image: { default: 'photo.png', 'French (fr)': 'photo.png' } }
    doc.choiceLists.colors = {
      name: 'colors',
      choices: [{ name: 'red', media: { image: { default: 'photo.png' } } } satisfies Choice],
    }

    const outcome = renameAttachmentRefs(doc, 'photo.png', 'picture.png')

    expect(outcome).toEqual({ ok: true, referencesUpdated: 3 })
    expect(q.media?.image?.default).toBe('picture.png')
    expect(q.media?.image?.['French (fr)']).toBe('picture.png')
    expect(doc.choiceLists.colors.choices[0].media?.image?.default).toBe('picture.png')
  })

  it('rejects an extension change without mutating the document', () => {
    const doc = newDocument('T')
    attach(doc, 'sites.csv')
    const before = structuredClone(doc)

    const outcome = renameAttachmentRefs(doc, 'sites.csv', 'sites.txt')

    expect(outcome).toEqual({ ok: false, reason: 'extension-changed' })
    expect(doc).toEqual(before)
  })

  it('rejects a collision with another attachment', () => {
    const doc = newDocument('T')
    attach(doc, 'sites.csv')
    attach(doc, 'villages.csv')
    expect(renameAttachmentRefs(doc, 'sites.csv', 'villages.csv')).toEqual({ ok: false, reason: 'collision' })
  })

  it('rejects an unknown source filename', () => {
    const doc = newDocument('T')
    expect(renameAttachmentRefs(doc, 'ghost.csv', 'real.csv')).toEqual({ ok: false, reason: 'not-found' })
  })

  it('is a no-op when from === to', () => {
    const doc = newDocument('T')
    attach(doc, 'sites.csv')
    expect(renameAttachmentRefs(doc, 'sites.csv', 'sites.csv')).toEqual({ ok: true, referencesUpdated: 0 })
  })
})

describe('firstFreeAttachmentName', () => {
  it('returns the input unchanged when free', () => {
    expect(firstFreeAttachmentName(new Set(), 'sites.csv')).toBe('sites.csv')
  })

  it('returns name-2.ext when name.ext is taken', () => {
    expect(firstFreeAttachmentName(new Set(['sites.csv']), 'sites.csv')).toBe('sites-2.csv')
  })

  it('returns name-3.ext when both name.ext and name-2.ext are taken', () => {
    expect(firstFreeAttachmentName(new Set(['sites.csv', 'sites-2.csv']), 'sites.csv')).toBe('sites-3.csv')
  })

  it('handles a filename with no extension', () => {
    expect(firstFreeAttachmentName(new Set(['README']), 'README')).toBe('README-2')
  })
})
