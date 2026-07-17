import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { toArrayBuffer } from '../../tests/helpers/bytes'
import { doc, q } from '../../tests/helpers/doc-builders'
import { exportZip } from './export/zip'
import { classifyZip, parseFormBundleZip } from './import-zip'
import type { AttachmentRef } from './model/types'
import { writeXlsForm } from './xlsform/writer'
import { buildWorkspaceArchive } from './workspace/archive'

const attachment = (id: string, filename: string, role: AttachmentRef['role'] = 'csv'): AttachmentRef =>
  ({ id, filename, mediatype: 'text/csv', size: 3, role })

const bundleDoc = () => {
  const d = doc({
    title: 'Bundle Test',
    formId: 'bundle_test',
    children: [q('select_one_from_file', 'v', 'V', { itemsetFile: 'villages.csv' })],
  })
  d.attachments = [attachment('a1', 'villages.csv'), attachment('a2', 'logo.png', 'media')]
  return d
}

const bundleBlobs = () => new Map<string, Blob | Uint8Array>([
  ['a1', new TextEncoder().encode('name,label\nx,X\n')],
  ['a2', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })],
])

describe('parseFormBundleZip', () => {
  it('round-trips the xform variant produced by exportZip', async () => {
    const d = bundleDoc()
    const { data, issues: exportIssues } = await exportZip(d, bundleBlobs(), 'xform')
    expect(exportIssues.filter((i) => i.severity === 'error')).toEqual([])

    const result = await parseFormBundleZip(toArrayBuffer(data))

    expect(result.kind).toBe('xform')
    expect(result.document).not.toBeNull()
    expect(result.document?.settings.formTitle).toBe('Bundle Test')
    expect(result.document?.settings.formId).toBe('bundle_test')

    const byName = Object.fromEntries((result.attachments ?? []).map((a) => [a.filename, a]))
    expect(byName['villages.csv'].mediatype).toBe('text/csv')
    expect(byName['villages.csv'].blob.size).toBe(new TextEncoder().encode('name,label\nx,X\n').length)
    expect(byName['logo.png'].mediatype).toBe('image/png')
    expect(byName['logo.png'].blob.size).toBe(3)

    const roles = Object.fromEntries((result.document?.attachments ?? []).map((r) => [r.filename, r.role]))
    expect(roles['villages.csv']).toBe('csv')
    expect(roles['logo.png']).toBe('media')
  })

  it('round-trips the xlsform variant produced by exportZip', async () => {
    const d = bundleDoc()
    const { data, issues: exportIssues } = await exportZip(d, bundleBlobs(), 'xlsform')
    expect(exportIssues.filter((i) => i.severity === 'error')).toEqual([])

    const result = await parseFormBundleZip(toArrayBuffer(data))

    expect(result.kind).toBe('xlsform')
    expect(result.document).not.toBeNull()
    expect(result.document?.settings.formId).toBe('bundle_test')

    const byName = Object.fromEntries((result.attachments ?? []).map((a) => [a.filename, a]))
    expect(byName['villages.csv'].mediatype).toBe('text/csv')
    expect(byName['logo.png'].mediatype).toBe('image/png')

    const roles = Object.fromEntries((result.document?.attachments ?? []).map((r) => [r.filename, r.role]))
    expect(roles['villages.csv']).toBe('csv')
    expect(roles['logo.png']).toBe('media')
  })

  it('prefers form.xml when both form.xml and form.xlsx are present, with a warning', async () => {
    const d = bundleDoc()
    const { data: xmlData } = await exportZip(d, bundleBlobs(), 'xform')
    const xmlZip = await JSZip.loadAsync(xmlData)
    const xml = await xmlZip.file('form.xml')!.async('string')

    const zip = new JSZip()
    zip.file('form.xml', xml)
    zip.file('form.xlsx', new Uint8Array([1, 2, 3])) // never parsed — presence alone triggers the warning
    const data = await zip.generateAsync({ type: 'uint8array' })

    const result = await parseFormBundleZip(toArrayBuffer(data))

    expect(result.kind).toBe('xform')
    expect(result.document).not.toBeNull()
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'import.zip-both-forms',
    }))
  })

  it('errors when neither form.xml nor form.xlsx is present', async () => {
    const zip = new JSZip()
    zip.file('readme.txt', 'nothing to see here')
    const data = await zip.generateAsync({ type: 'uint8array' })

    const result = await parseFormBundleZip(toArrayBuffer(data))

    expect(result.document).toBeNull()
    expect(result.attachments).toBeUndefined()
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: 'error',
      code: 'import.zip-no-form',
    }))
  })

  it('errors with a helpful message when the zip is a workspace archive', async () => {
    const d = doc({ title: 'W', formId: 'w', children: [q('text', 'a', 'A')] })
    const data = await buildWorkspaceArchive(
      [{ recordId: 'rec-1', meta: { title: 'W', formId: 'w', version: '1' }, doc: d, attachments: [] }],
      '2.0.0-test',
      '2026-07-17T00:00:00.000Z'
    )

    const result = await parseFormBundleZip(toArrayBuffer(data))

    expect(result.document).toBeNull()
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: 'error',
      code: 'import.workspace-archive',
    }))
  })

  it('errors when the bytes are not a readable ZIP archive', async () => {
    const data = new TextEncoder().encode('this is definitely not a zip file')

    const result = await parseFormBundleZip(toArrayBuffer(data))

    expect(result.document).toBeNull()
    expect(result.attachments).toBeUndefined()
    expect(result.issues).toContainEqual(expect.objectContaining({
      severity: 'error',
      code: 'import.invalid-zip',
    }))
  })

  it('still imports a bundle that carries a stray root manifest.json', async () => {
    const d = bundleDoc()
    const { data: xmlData } = await exportZip(d, bundleBlobs(), 'xform')
    const xmlZip = await JSZip.loadAsync(xmlData)

    const zip = new JSZip()
    zip.file('form.xml', await xmlZip.file('form.xml')!.async('string'))
    zip.file('media/villages.csv', 'name,label\nx,X\n')
    // e.g. a PWA manifest swept up when a user re-zips an exported folder —
    // must NOT misroute to the workspace-archive error.
    zip.file('manifest.json', '{"name":"unrelated"}')
    const data = await zip.generateAsync({ type: 'uint8array' })

    const result = await parseFormBundleZip(toArrayBuffer(data))

    expect(result.document).not.toBeNull()
    expect(result.kind).toBe('xform')
    expect(result.issues.map((i) => i.code)).not.toContain('import.workspace-archive')
    expect((result.attachments ?? []).map((a) => a.filename)).toEqual(['villages.csv'])
  })

  it('reads media entries written with backslash separators', async () => {
    const d = bundleDoc()
    const { data: xmlData } = await exportZip(d, bundleBlobs(), 'xform')
    const xmlZip = await JSZip.loadAsync(xmlData)

    const zip = new JSZip()
    zip.file('form.xml', await xmlZip.file('form.xml')!.async('string'))
    zip.file('media\\villages.csv', 'name,label\nx,X\n') // some Windows tools emit these
    const data = await zip.generateAsync({ type: 'uint8array' })

    const result = await parseFormBundleZip(toArrayBuffer(data))

    expect((result.attachments ?? []).map((a) => a.filename)).toEqual(['villages.csv'])
  })

  it('ignores nested media subfolders and directory entries, but keeps unreferenced top-level media', async () => {
    const d = bundleDoc()
    const { data: xmlData } = await exportZip(d, bundleBlobs(), 'xform')
    const xmlZip = await JSZip.loadAsync(xmlData)
    const xml = await xmlZip.file('form.xml')!.async('string')

    const zip = new JSZip()
    zip.file('form.xml', xml)
    zip.file('media/villages.csv', 'name,label\nx,X\n')
    zip.file('media/logo.png', new Uint8Array([1, 2, 3]))
    zip.file('media/sub/nested.png', new Uint8Array([9, 9]))
    zip.file('media/extra.txt', 'unreferenced but should still import')
    const data = await zip.generateAsync({ type: 'uint8array' })

    const result = await parseFormBundleZip(toArrayBuffer(data))

    expect(result.document).not.toBeNull()
    const names = (result.attachments ?? []).map((a) => a.filename).sort()
    expect(names).toEqual(['extra.txt', 'logo.png', 'villages.csv'])

    const docNames = (result.document?.attachments ?? []).map((r) => r.filename).sort()
    expect(docNames).toEqual(['extra.txt', 'logo.png', 'villages.csv'])
  })
})

describe('classifyZip', () => {
  it('classifies an exportZip bundle as bundle', async () => {
    const d = doc({ title: 'B', formId: 'b', children: [q('text', 'a', 'A')] })
    const { data } = await exportZip(d, new Map(), 'xform')
    expect(await classifyZip(toArrayBuffer(data))).toBe('bundle')
  })

  it('classifies an xlsform-variant bundle as bundle', async () => {
    const d = doc({ title: 'B', formId: 'b', children: [q('text', 'a', 'A')] })
    const { data } = await exportZip(d, new Map(), 'xlsform')
    expect(await classifyZip(toArrayBuffer(data))).toBe('bundle')
  })

  it('classifies a workspace archive as workspace-archive', async () => {
    const d = doc({ title: 'W', formId: 'w', children: [q('text', 'a', 'A')] })
    const data = await buildWorkspaceArchive(
      [{ recordId: 'rec-1', meta: { title: 'W', formId: 'w', version: '1' }, doc: d, attachments: [] }],
      '2.0.0-test',
      '2026-07-17T00:00:00.000Z'
    )
    expect(await classifyZip(toArrayBuffer(data))).toBe('workspace-archive')
  })

  it('classifies a plain .xlsx (no form.xml/form.xlsx/manifest.json at root) as other', async () => {
    const d = doc({ title: 'X', formId: 'x', children: [q('text', 'a', 'A')] })
    const bytes = await writeXlsForm(d)
    expect(await classifyZip(toArrayBuffer(bytes))).toBe('other')
  })

  it('classifies unreadable bytes as other', async () => {
    const data = new TextEncoder().encode('not a zip either')
    expect(await classifyZip(toArrayBuffer(data))).toBe('other')
  })
})
