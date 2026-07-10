import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'

import { createNode, newDocument } from '@/core/model/factory'
import { insertNode } from '@/core/model/ops'
import { DEFAULT_LANG, type ContainerNode, type FormDocument } from '@/core/model/types'

import { BuilderDb, db } from './db'
import * as templatesRepo from './templates-repo'

beforeEach(async () => {
  await db.templates.clear()
})

/** Seven questions (one nested in a repeat, one unlabeled meta) + refs. */
const sampleDoc = (): FormDocument => {
  const doc = newDocument('Sample')
  for (const label of ['One', 'Two', 'Three', 'Four', 'Five', 'Six']) {
    const node = createNode(doc, 'text')
    node.label = { [DEFAULT_LANG]: label }
    insertNode(doc, node, null)
  }
  const repeat = createNode(doc, 'repeat') as ContainerNode
  insertNode(doc, repeat, null)
  insertNode(doc, createNode(doc, 'integer'), repeat.id)
  const meta = createNode(doc, 'start')
  insertNode(doc, meta, null)
  doc.attachments.push({ id: 'a1', filename: 'x.csv', mediatype: 'text/csv', size: 1, role: 'csv' })
  return doc
}

describe('templates repo', () => {
  it('addTemplate strips attachments and precomputes count + preview', async () => {
    const doc = sampleDoc()
    const record = await templatesRepo.addTemplate(doc, 'My template', 'A description')
    expect(record.title).toBe('My template')
    expect(record.description).toBe('A description')
    // 6 labeled texts + 1 repeat child + 1 meta = 8 questions.
    expect(record.questionCount).toBe(8)
    // Preview: first 5 non-empty labels only (meta has no label).
    expect(record.preview).toEqual(['One', 'Two', 'Three', 'Four', 'Five'])
    expect(record.doc.attachments).toEqual([])
    // The source doc keeps its attachment refs.
    expect(doc.attachments).toHaveLength(1)

    const stored = await db.templates.get(record.id)
    expect(stored?.doc.settings.formTitle).toBe('Sample')
  })

  it('lists templates newest-first and deletes them', async () => {
    const a = await templatesRepo.addTemplate(sampleDoc(), 'A', '')
    await db.templates.put({ ...a, updatedAt: a.updatedAt - 1000 })
    const b = await templatesRepo.addTemplate(sampleDoc(), 'B', '')
    expect((await templatesRepo.listTemplates()).map((t) => t.title)).toEqual(['B', 'A'])
    await templatesRepo.deleteTemplate(b.id)
    expect((await templatesRepo.listTemplates()).map((t) => t.title)).toEqual(['A'])
  })

  it('upgrades a v1 database in place, keeping existing forms', async () => {
    // Simulate a browser that only ever saw schema v1 (no templates table),
    // on an isolated IDBFactory so the shared app db is untouched.
    const indexedDB = new IDBFactory()
    const v1 = new Dexie('odk-form-builder', { indexedDB, IDBKeyRange })
    v1.version(1).stores({
      forms: 'id, updatedAt, title',
      attachments: 'id, formRecordId',
      snapshots: 'id, formRecordId, createdAt',
    })
    await v1.table('forms').add({
      id: 'f1',
      title: 'Pre-upgrade form',
      formId: 'pre_upgrade',
      version: '1',
      questionCount: 0,
      createdAt: 1,
      updatedAt: 2,
      doc: newDocument('Pre-upgrade form'),
    })
    v1.close()

    const upgraded = new BuilderDb({ indexedDB, IDBKeyRange })
    try {
      expect(await upgraded.forms.count()).toBe(1)
      expect((await upgraded.forms.get('f1'))?.title).toBe('Pre-upgrade form')
      expect(upgraded.verno).toBe(2)
      // The new table is usable right away.
      await upgraded.templates.add({
        id: 't1',
        title: 'T',
        description: '',
        questionCount: 0,
        preview: [],
        createdAt: 1,
        updatedAt: 1,
        doc: newDocument('T'),
      })
      expect(await upgraded.templates.count()).toBe(1)
    } finally {
      upgraded.close()
    }
  })
})
