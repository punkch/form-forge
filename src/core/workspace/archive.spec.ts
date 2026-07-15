import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { doc, q } from '../../../tests/helpers/doc-builders'
import type { FormDocument } from '../model/types'
import {
  buildWorkspaceArchive,
  readWorkspaceArchive,
  WORKSPACE_FORMAT_VERSION,
  type ArchiveFormInput,
} from './archive'

const jsonClone = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

const formInput = (recordId: string, document: FormDocument, attachments: ArchiveFormInput['attachments'] = []): ArchiveFormInput => ({
  recordId,
  meta: {
    title: document.settings.formTitle ?? '',
    formId: document.settings.formId ?? '',
    version: document.settings.version ?? '',
    createdAt: 1000,
    updatedAt: 2000,
  },
  doc: document,
  attachments,
})

describe('workspace archive', () => {
  it('round-trips forms, meta and attachment bytes through build → read', async () => {
    const docA = doc({ title: 'Alpha', formId: 'alpha', children: [q('text', 'a', 'A')] })
    docA.attachments = [
      { id: 'att-1', filename: 'villages.csv', mediatype: 'text/csv', size: 3, role: 'csv' },
    ]
    const docB = doc({ title: 'Beta', formId: 'beta', children: [q('integer', 'b', 'B')] })
    const forms = [
      formInput('rec-a', docA, [
        { filename: 'villages.csv', mediatype: 'text/csv', blob: new Blob(['a,b'], { type: 'text/csv' }) },
      ]),
      formInput('rec-b', docB),
    ]

    const data = await buildWorkspaceArchive(forms, '2.0.0-test', '2026-07-09T23:52:00.000Z')
    const zip = await JSZip.loadAsync(data)
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
    expect(manifest).toEqual({
      formatVersion: 1,
      exportedAt: '2026-07-09T23:52:00.000Z',
      appVersion: '2.0.0-test',
      forms: [
        { recordId: 'rec-a', formId: 'alpha', title: 'Alpha' },
        { recordId: 'rec-b', formId: 'beta', title: 'Beta' },
      ],
    })

    const { forms: parsed, issues } = await readWorkspaceArchive(toArrayBuffer(data))
    expect(issues).toEqual([])
    expect(parsed).toHaveLength(2)
    expect(parsed[0].recordId).toBe('rec-a')
    expect(jsonClone(parsed[0].doc)).toEqual(jsonClone(docA))
    expect(parsed[0].meta).toEqual(forms[0].meta)
    expect(parsed[0].attachments).toHaveLength(1)
    expect(parsed[0].attachments[0].filename).toBe('villages.csv')
    expect(parsed[0].attachments[0].mediatype).toBe('text/csv')
    expect(new Uint8Array(await parsed[0].attachments[0].blob.arrayBuffer()))
      .toEqual(new TextEncoder().encode('a,b'))
    expect(jsonClone(parsed[1].doc)).toEqual(jsonClone(docB))
    expect(parsed[1].attachments).toEqual([])
  })

  it('reports a corrupt zip as a single error', async () => {
    const { forms, issues } = await readWorkspaceArchive(toArrayBuffer(new TextEncoder().encode('not a zip')))
    expect(forms).toEqual([])
    expect(issues).toEqual([expect.objectContaining({
      severity: 'error',
      code: 'workspace.invalid-archive',
    })])
  })

  it('reports a zip without manifest.json as not-an-archive', async () => {
    const zip = new JSZip()
    zip.file('xl/workbook.xml', '<workbook/>')
    const data = await zip.generateAsync({ type: 'uint8array' })
    const { forms, issues } = await readWorkspaceArchive(toArrayBuffer(data))
    expect(forms).toEqual([])
    expect(issues).toEqual([expect.objectContaining({
      severity: 'error',
      code: 'workspace.not-an-archive',
    })])
    expect(issues[0].message).toContain('not a workspace archive')
  })

  it('treats a manifest without a numeric formatVersion as not-an-archive', async () => {
    for (const manifest of [{ forms: [] }, { formatVersion: 'one', forms: [] }]) {
      const zip = new JSZip()
      zip.file('manifest.json', JSON.stringify(manifest))
      const data = await zip.generateAsync({ type: 'uint8array' })
      const { forms, issues } = await readWorkspaceArchive(toArrayBuffer(data))
      expect(forms).toEqual([])
      expect(issues).toEqual([expect.objectContaining({
        severity: 'error',
        code: 'workspace.not-an-archive',
      })])
    }
  })

  it('reports a manifest form entry with no recordId as unreadable', async () => {
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify({ formatVersion: 1, forms: [{ formId: 'x', title: 'X' }] }))
    const data = await zip.generateAsync({ type: 'uint8array' })
    const { forms, issues } = await readWorkspaceArchive(toArrayBuffer(data))
    expect(forms).toEqual([])
    expect(issues).toEqual([expect.objectContaining({ code: 'workspace.form-unreadable' })])
  })

  it('parses a form whose referenced blob is absent, skipping the dangling ref', async () => {
    const dangling = doc({ title: 'Dangling', formId: 'dangling', children: [] })
    dangling.attachments = [
      { id: 'att-x', filename: 'gone.csv', mediatype: 'text/csv', size: 1, role: 'csv' },
    ]
    const data = await buildWorkspaceArchive(
      [formInput('rec-d', dangling)], '2.0.0-test', '2026-07-09T23:52:00.000Z'
    )
    const { forms, issues } = await readWorkspaceArchive(toArrayBuffer(data))
    expect(issues).toEqual([])
    expect(forms).toHaveLength(1)
    expect(forms[0].attachments).toEqual([])
    // The ref survives on the doc; the import side drops it (see workspace-io).
    expect(forms[0].doc.attachments.map((a) => a.filename)).toEqual(['gone.csv'])
  })

  it('rejects an unsupported (future) formatVersion', async () => {
    const zip = new JSZip()
    // One past the highest version this build understands.
    zip.file('manifest.json', JSON.stringify({ formatVersion: WORKSPACE_FORMAT_VERSION + 1, forms: [] }))
    const data = await zip.generateAsync({ type: 'uint8array' })
    const { forms, issues } = await readWorkspaceArchive(toArrayBuffer(data))
    expect(forms).toEqual([])
    expect(issues).toEqual([expect.objectContaining({
      severity: 'error',
      code: 'workspace.format-version-unsupported',
    })])
  })

  it('skips unreadable forms but keeps the rest', async () => {
    const good = doc({ title: 'Good', formId: 'good', children: [q('text', 'g', 'G')] })
    const data = await buildWorkspaceArchive(
      [formInput('rec-good', good)], '2.0.0-test', '2026-07-09T23:52:00.000Z'
    )
    const zip = await JSZip.loadAsync(data)
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
    manifest.forms.push(
      { recordId: 'rec-corrupt', formId: 'corrupt', title: 'Corrupt' },
      { recordId: 'rec-missing', formId: 'missing', title: 'Missing' }
    )
    zip.file('manifest.json', JSON.stringify(manifest))
    zip.file('forms/rec-corrupt/form.json', '{ not json')
    zip.file('forms/rec-corrupt/meta.json', '{}')
    const patched = await zip.generateAsync({ type: 'uint8array' })

    const { forms, issues } = await readWorkspaceArchive(toArrayBuffer(patched))
    expect(forms).toHaveLength(1)
    expect(forms[0].recordId).toBe('rec-good')
    expect(issues.filter((i) => i.code === 'workspace.form-unreadable')).toHaveLength(2)
  })

  it('carries preferences.json in a backup and reads it back', async () => {
    const good = doc({ title: 'G', formId: 'g', children: [] })
    const preferences = { theme: 'dark', accent: 'teal', locale: 'fr' }
    const data = await buildWorkspaceArchive(
      [formInput('rec-g', good)], '2.0.0-test', '2026-07-09T23:52:00.000Z',
      { central: { servers: [], targets: [] }, preferences }
    )
    const zip = await JSZip.loadAsync(data)
    expect(zip.file('preferences.json')).not.toBeNull()

    const result = await readWorkspaceArchive(toArrayBuffer(data))
    expect(result.issues).toEqual([])
    expect(result.preferences).toEqual(preferences)
  })

  it('has no preferences.json for a v1 share', async () => {
    const good = doc({ title: 'G', formId: 'g', children: [] })
    const data = await buildWorkspaceArchive([formInput('rec-g', good)], '2.0.0-test', '2026-07-09T23:52:00.000Z')
    const zip = await JSZip.loadAsync(data)
    expect(zip.file('preferences.json')).toBeNull()
    expect((await readWorkspaceArchive(toArrayBuffer(data))).preferences).toBeUndefined()
  })

  it('skips an unreadable preferences.json with a warning, keeping the forms', async () => {
    const good = doc({ title: 'G', formId: 'g', children: [q('text', 'g', 'G')] })
    const data = await buildWorkspaceArchive(
      [formInput('rec-g', good)], '2.0.0-test', '2026-07-09T23:52:00.000Z',
      { central: { servers: [], targets: [] }, preferences: { theme: 'dark' } }
    )
    const zip = await JSZip.loadAsync(data)
    zip.file('preferences.json', '{ not json')
    const patched = await zip.generateAsync({ type: 'uint8array' })

    const result = await readWorkspaceArchive(toArrayBuffer(patched))
    expect(result.forms).toHaveLength(1)
    expect(result.preferences).toBeUndefined()
    expect(result.issues).toEqual([expect.objectContaining({ code: 'workspace.preferences-unreadable' })])
  })

  it('skips forms whose document schema version is unsupported', async () => {
    const future = doc({ title: 'Future', formId: 'future', children: [] })
    const raw = jsonClone(future)
    raw.schemaVersion = 99 as never
    const data = await buildWorkspaceArchive(
      [formInput('rec-future', raw)], '2.0.0-test', '2026-07-09T23:52:00.000Z'
    )
    const { forms, issues } = await readWorkspaceArchive(toArrayBuffer(data))
    expect(forms).toEqual([])
    expect(issues).toEqual([expect.objectContaining({ code: 'doc.schema-version-unsupported' })])
  })
})
