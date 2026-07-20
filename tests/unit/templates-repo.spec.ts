/**
 * templates-repo edit paths on BOTH backends: the Dexie default and embed
 * mode's memory backend must behave identically (see tests/helpers/backends.ts).
 * src/persistence/templates-repo.spec.ts covers the Dexie-only add/list/delete
 * paths (and the schema-upgrade path) by reading db.templates directly; this
 * file covers updateTemplate/replaceTemplate through the backend seam only.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { createNode, newDocument } from '@/core/model/factory'
import { countQuestions, insertNode } from '@/core/model/ops'
import { DEFAULT_LANG, type FormDocument } from '@/core/model/types'
import { getPersistenceBackend } from '@/persistence/backend'
import * as templatesRepo from '@/persistence/templates-repo'

import { backendCases } from '../helpers/backends'

/** A doc with one labeled text question per entry in `labels`. */
const docWithQuestions = (title: string, labels: string[]): FormDocument => {
  const doc = newDocument(title)
  for (const label of labels) {
    const node = createNode(doc, 'text')
    node.label = { [DEFAULT_LANG]: label }
    insertNode(doc, node, null)
  }
  return doc
}

describe.each(backendCases)('templates repo edits ($name backend)', ({ setup }) => {
  beforeEach(setup)

  it('updateTemplate changes title/description while preserving doc, createdAt, questionCount and preview', async () => {
    const doc = docWithQuestions('Original', ['One', 'Two', 'Three'])
    const record = await templatesRepo.addTemplate(doc, 'Original title', 'Original description')

    await templatesRepo.updateTemplate(record.id, { title: 'Renamed', description: 'New description' })

    const updated = await getPersistenceBackend().getTemplate(record.id)
    expect(updated).toBeDefined()
    expect(updated!.title).toBe('Renamed')
    expect(updated!.description).toBe('New description')
    expect(updated!.doc).toEqual(record.doc)
    expect(updated!.createdAt).toBe(record.createdAt)
    expect(updated!.questionCount).toBe(record.questionCount)
    expect(updated!.preview).toEqual(record.preview)
  })

  it('replaceTemplate swaps the doc and recomputes questionCount/preview while preserving createdAt', async () => {
    const original = docWithQuestions('Original', ['One'])
    const record = await templatesRepo.addTemplate(original, 'Original title', 'Original description')

    const replacement = docWithQuestions('Replacement', ['Alpha', 'Beta', 'Gamma'])
    await templatesRepo.replaceTemplate(record.id, replacement, 'Replaced title', 'Replaced description')

    const updated = await getPersistenceBackend().getTemplate(record.id)
    expect(updated).toBeDefined()
    expect(updated!.title).toBe('Replaced title')
    expect(updated!.description).toBe('Replaced description')
    expect(updated!.doc.settings.formTitle).toBe('Replacement')
    expect(updated!.questionCount).toBe(countQuestions(replacement))
    expect(updated!.preview).toEqual(templatesRepo.templatePreview(replacement))
    // Overwrite-on-save keeps the original record's createdAt.
    expect(updated!.createdAt).toBe(record.createdAt)
  })

  it('updateTemplate and replaceTemplate are no-ops for an unknown id', async () => {
    await expect(
      templatesRepo.updateTemplate('missing', { title: 'x', description: 'y' })
    ).resolves.toBeUndefined()
    await expect(
      templatesRepo.replaceTemplate('missing', docWithQuestions('X', []), 'x', 'y')
    ).resolves.toBeUndefined()

    expect(await getPersistenceBackend().getTemplate('missing')).toBeUndefined()
  })
})

describe('firstFreeTemplateTitle', () => {
  it('returns the desired title unchanged when it is free', () => {
    expect(templatesRepo.firstFreeTemplateTitle(['Other', 'Roster'], 'Site visit')).toBe('Site visit')
  })

  it('suffixes " (2)" when the desired title collides', () => {
    expect(templatesRepo.firstFreeTemplateTitle(['Site visit'], 'Site visit')).toBe('Site visit (2)')
  })

  it('is case-insensitive, matching the save-collision check', () => {
    expect(templatesRepo.firstFreeTemplateTitle(['SITE VISIT'], 'site visit')).toBe('site visit (2)')
  })

  it('trims surrounding whitespace before comparing and before returning', () => {
    expect(templatesRepo.firstFreeTemplateTitle(['Site visit'], '  Site visit  ')).toBe('Site visit (2)')
    expect(templatesRepo.firstFreeTemplateTitle([' Other '], '  Site visit  ')).toBe('Site visit')
  })

  it('skips already-taken suffixes and fills the first free gap', () => {
    expect(templatesRepo.firstFreeTemplateTitle(['Site visit', 'Site visit (2)'], 'Site visit')).toBe('Site visit (3)')
    expect(
      templatesRepo.firstFreeTemplateTitle(['Site visit', 'Site visit (2)', 'Site visit (4)'], 'Site visit')
    ).toBe('Site visit (3)')
  })
})
