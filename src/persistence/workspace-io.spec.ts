import { beforeEach, describe, expect, it, vi } from 'vitest'

import { newDocument } from '@/core/model/factory'
import { buildWorkspaceArchive, readWorkspaceArchive, type ParsedArchiveForm } from '@/core/workspace/archive'

import { db } from './db'
import * as attachmentsRepo from './attachments-repo'
import * as formsRepo from './forms-repo'
import { gatherArchiveForms, importArchiveForms } from './workspace-io'

beforeEach(async () => {
  await db.forms.clear()
  await db.attachments.clear()
  await db.snapshots.clear()
})

const blobText = async (blob: Blob): Promise<string> => blob.text()

/** Create a form whose doc references one stored attachment. */
const seedFormWithAttachment = async (title: string, filename = 'list.csv', content = 'a,b') => {
  const record = await formsRepo.createForm(newDocument(title))
  const att = await attachmentsRepo.addAttachment(record.id, filename, new Blob([content], { type: 'text/csv' }))
  const fetched = await formsRepo.getForm(record.id)
  fetched!.doc.attachments.push({
    id: att.id, filename: att.filename, mediatype: att.mediatype, size: att.size, role: 'csv',
  })
  await formsRepo.saveForm(record.id, fetched!.doc)
  return { record: (await formsRepo.getForm(record.id))!, att }
}

const parsedForm = (title: string, overrides: Partial<ParsedArchiveForm> = {}): ParsedArchiveForm => {
  const doc = newDocument(title)
  return {
    recordId: 'archived-rec',
    meta: {
      title,
      formId: doc.settings.formId ?? '',
      version: doc.settings.version ?? '',
      createdAt: 1234,
      updatedAt: 5678,
    },
    doc,
    attachments: [],
    ...overrides,
  }
}

describe('gatherArchiveForms', () => {
  it('collects forms with the attachments their docs reference, skipping orphans', async () => {
    const { record, att } = await seedFormWithAttachment('Survey')
    // Orphan record (e.g. left behind by a re-upload) — must not be exported.
    await attachmentsRepo.addAttachment(record.id, 'orphan.csv', new Blob(['o']))

    const forms = await gatherArchiveForms()
    expect(forms).toHaveLength(1)
    expect(forms[0].recordId).toBe(record.id)
    expect(forms[0].meta).toEqual({
      title: record.title,
      formId: record.formId,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    })
    expect(forms[0].attachments.map((a) => a.filename)).toEqual([att.filename])
    expect(await blobText(forms[0].attachments[0].blob)).toBe('a,b')
  })

  it('gathers only the requested record ids, ignoring unknown ones', async () => {
    const a = await formsRepo.createForm(newDocument('A'))
    await formsRepo.createForm(newDocument('B'))
    const forms = await gatherArchiveForms([a.id, 'missing'])
    expect(forms.map((f) => f.meta.title)).toEqual(['A'])
  })

  it('skips attachment refs whose blob record is gone', async () => {
    const { att } = await seedFormWithAttachment('Survey')
    await attachmentsRepo.deleteAttachment(att.id)
    const forms = await gatherArchiveForms()
    expect(forms[0].attachments).toEqual([])
  })
})

describe('importArchiveForms', () => {
  it('creates new record ids and remaps attachment ids like duplicateForm', async () => {
    const form = parsedForm('Imported')
    form.doc.attachments.push({
      id: 'old-att-id', filename: 'list.csv', mediatype: 'text/csv', size: 3, role: 'csv',
    })
    form.attachments.push({ filename: 'list.csv', mediatype: 'text/csv', blob: new Blob(['a,b'], { type: 'text/csv' }) })

    const { imported, issues } = await importArchiveForms([form])
    expect(imported).toBe(1)
    expect(issues).toEqual([])

    const records = await formsRepo.listForms()
    expect(records).toHaveLength(1)
    expect(records[0].id).not.toBe('archived-rec')
    const stored = await attachmentsRepo.listAttachments(records[0].id)
    expect(stored).toHaveLength(1)
    expect(stored[0].id).not.toBe('old-att-id')
    expect(records[0].doc.attachments[0].id).toBe(stored[0].id)
    expect(await blobText(stored[0].blob)).toBe('a,b')
  })

  it('preserves meta createdAt and stamps updatedAt with the import time', async () => {
    const before = Date.now()
    await importArchiveForms([parsedForm('Old form')])
    const [record] = await formsRepo.listForms()
    expect(record.createdAt).toBe(1234)
    expect(record.updatedAt).toBeGreaterThanOrEqual(before)
  })

  it('warns on form_id collisions but imports anyway', async () => {
    await formsRepo.createForm(newDocument('Existing'))
    const clash = parsedForm('Existing')
    const { imported, issues } = await importArchiveForms([clash])
    expect(imported).toBe(1)
    expect(issues).toEqual([expect.objectContaining({
      severity: 'warning',
      code: 'workspace.duplicate-form-id',
    })])
    expect(await formsRepo.listForms()).toHaveLength(2)
  })

  it('drops doc attachment refs whose blob is absent from the archive', async () => {
    const form = parsedForm('Dangling')
    form.doc.attachments.push({
      id: 'old-att-id', filename: 'gone.csv', mediatype: 'text/csv', size: 3, role: 'csv',
    })
    // No matching entry in form.attachments — the blob never made it into the archive.
    const { imported, issues } = await importArchiveForms([form])
    expect(imported).toBe(1)
    expect(issues).toEqual([])
    const [record] = await formsRepo.listForms()
    expect(record.doc.attachments).toEqual([])
    expect(await attachmentsRepo.listAttachments(record.id)).toEqual([])
  })

  it('isolates per-form failures: a failing write leaves earlier imports committed', async () => {
    const realAdd = db.forms.add.bind(db.forms)
    let calls = 0
    const spy = vi.spyOn(db.forms, 'add').mockImplementation((rec) => {
      if (++calls === 2) throw new Error('write failed')
      return realAdd(rec)
    })
    try {
      const { imported, issues } = await importArchiveForms([parsedForm('First'), parsedForm('Second')])
      expect(imported).toBe(1)
      expect(issues).toEqual([expect.objectContaining({
        severity: 'error',
        code: 'workspace.import-failed',
      })])
      const records = await formsRepo.listForms()
      expect(records.map((r) => r.title)).toEqual(['First'])
    } finally {
      spy.mockRestore()
    }
  })

  it('round-trips gather → build → read → import losslessly', async () => {
    const { record } = await seedFormWithAttachment('Loop', 'villages.csv', 'name\nx')
    const archive = await buildWorkspaceArchive(await gatherArchiveForms(), '2.0.0-test', new Date().toISOString())

    // Simulate "wipe site data".
    await db.forms.clear()
    await db.attachments.clear()

    const { forms, issues: readIssues } = await readWorkspaceArchive(
      archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer
    )
    expect(readIssues).toEqual([])
    const { imported, issues } = await importArchiveForms(forms)
    expect(imported).toBe(1)
    expect(issues).toEqual([])

    const [restored] = await formsRepo.listForms()
    expect(restored.createdAt).toBe(record.createdAt)
    const stripIds = (doc: unknown): unknown =>
      JSON.parse(JSON.stringify(doc, (key, value) => (key === 'id' ? undefined : value)))
    expect(stripIds(restored.doc)).toEqual(stripIds(record.doc))
    const [att] = await attachmentsRepo.listAttachments(restored.id)
    expect(att.filename).toBe('villages.csv')
    expect(await blobText(att.blob)).toBe('name\nx')
  })
})
