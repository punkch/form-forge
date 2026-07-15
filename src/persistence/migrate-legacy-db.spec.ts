import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'

import { newDocument } from '@/core/model/factory'

import { BuilderDb, CURRENT_DB_NAME, LEGACY_DB_NAME, type FormRecord } from './db'
import { migrateLegacyDb } from './migrate-legacy-db'

const form = (id: string, title: string): FormRecord => ({
  id,
  title,
  formId: id,
  version: '1',
  questionCount: 0,
  createdAt: 1,
  updatedAt: 2,
  doc: newDocument(title),
})

/** Seed a full v3 legacy database (old name) with the given forms + a template. */
const seedLegacy = async (indexedDB: IDBFactory, forms: FormRecord[]): Promise<void> => {
  const legacy = new BuilderDb({ indexedDB, IDBKeyRange }, LEGACY_DB_NAME)
  await legacy.forms.bulkPut(forms)
  await legacy.templates.put({
    id: 't1',
    title: 'Tmpl',
    description: '',
    questionCount: 0,
    preview: [],
    createdAt: 1,
    updatedAt: 2,
    doc: newDocument('Tmpl'),
  })
  await legacy.centralServers.put({ id: 'srv', name: 'Prod', baseUrl: 'https://c.example' })
  legacy.close()
}

const names = async (indexedDB: IDBFactory): Promise<string[]> =>
  (await indexedDB.databases()).map((d) => d.name ?? '')

describe('migrateLegacyDb', () => {
  it('copies every store from the legacy DB into form-forge, then deletes the legacy DB', async () => {
    const indexedDB = new IDBFactory()
    await seedLegacy(indexedDB, [form('f1', 'One'), form('f2', 'Two')])

    expect(await migrateLegacyDb({ indexedDB, IDBKeyRange })).toBe(true)

    const current = new BuilderDb({ indexedDB, IDBKeyRange })
    try {
      expect((await current.forms.orderBy('title').toArray()).map((f) => f.title)).toEqual(['One', 'Two'])
      expect(await current.templates.count()).toBe(1)
      expect((await current.centralServers.get('srv'))?.name).toBe('Prod')
    } finally {
      current.close()
    }
    expect(await names(indexedDB)).not.toContain(LEGACY_DB_NAME)
    expect(await names(indexedDB)).toContain(CURRENT_DB_NAME)
  })

  it('is a no-op when there is no legacy database', async () => {
    const indexedDB = new IDBFactory()
    expect(await migrateLegacyDb({ indexedDB, IDBKeyRange })).toBe(false)
    // Must not have created either database as a side effect of probing.
    expect(await names(indexedDB)).toEqual([])
  })

  it('does not clobber a form-forge database that already holds data', async () => {
    const indexedDB = new IDBFactory()
    await seedLegacy(indexedDB, [form('legacy', 'Legacy form')])
    // A form the user created after the rename already lives in the new DB.
    const current = new BuilderDb({ indexedDB, IDBKeyRange })
    await current.forms.put(form('fresh', 'Fresh form'))
    current.close()

    expect(await migrateLegacyDb({ indexedDB, IDBKeyRange })).toBe(false)

    const reopened = new BuilderDb({ indexedDB, IDBKeyRange })
    try {
      // The new DB is untouched, and the legacy DB is left for manual recovery.
      expect((await reopened.forms.toArray()).map((f) => f.id)).toEqual(['fresh'])
    } finally {
      reopened.close()
    }
    expect(await names(indexedDB)).toContain(LEGACY_DB_NAME)
  })

  it('is idempotent: a second run finds nothing to migrate', async () => {
    const indexedDB = new IDBFactory()
    await seedLegacy(indexedDB, [form('f1', 'One')])

    expect(await migrateLegacyDb({ indexedDB, IDBKeyRange })).toBe(true)
    expect(await migrateLegacyDb({ indexedDB, IDBKeyRange })).toBe(false)
  })

  it('reports nothing copied when the legacy DB exists but is empty', async () => {
    const indexedDB = new IDBFactory()
    // Create the legacy DB but store nothing in it.
    const legacy = new BuilderDb({ indexedDB, IDBKeyRange }, LEGACY_DB_NAME)
    await legacy.forms.count()
    legacy.close()

    expect(await migrateLegacyDb({ indexedDB, IDBKeyRange })).toBe(false)
  })
})
