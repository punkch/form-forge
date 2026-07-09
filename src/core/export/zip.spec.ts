import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { doc, q } from '../../../tests/helpers/doc-builders'
import type { AttachmentRef } from '../model/types'
import { exportZip } from './zip'

const attachment = (id: string, filename: string, role: AttachmentRef['role'] = 'csv'): AttachmentRef =>
  ({ id, filename, mediatype: 'text/csv', size: 3, role })

describe('exportZip', () => {
  it('packs form.xml plus media/<filename> entries', async () => {
    const d = doc({
      title: 'Zip Test',
      formId: 'zip_test',
      children: [q('select_one_from_file', 'v', 'V', { itemsetFile: 'villages.csv' })],
    })
    d.attachments = [attachment('a1', 'villages.csv'), attachment('a2', 'logo.png', 'media')]
    const blobs = new Map<string, Blob | Uint8Array>([
      ['a1', new TextEncoder().encode('name,label\nx,X\n')],
      ['a2', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })],
    ])

    const { data, issues } = await exportZip(d, blobs)
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])

    const zip = await JSZip.loadAsync(data)
    expect(Object.keys(zip.files).sort()).toEqual(['form.xml', 'media/', 'media/logo.png', 'media/villages.csv'])
    const xml = await zip.file('form.xml')?.async('string')
    expect(xml).toContain('<h:title>Zip Test</h:title>')
    expect(xml).toContain('jr://file-csv/villages.csv')
    expect(await zip.file('media/villages.csv')?.async('string')).toBe('name,label\nx,X\n')
    expect(await zip.file('media/logo.png')?.async('uint8array')).toEqual(new Uint8Array([1, 2, 3]))
  })

  it('warns about attachment refs without a stored blob', async () => {
    const d = doc({ title: 'T', formId: 't', children: [q('text', 'a', 'A')] })
    d.attachments = [attachment('gone', 'missing.csv')]

    const { data, issues } = await exportZip(d, new Map())
    expect(issues).toContainEqual(expect.objectContaining({
      severity: 'warning',
      code: 'export.missing-attachment',
    }))
    const zip = await JSZip.loadAsync(data)
    expect(Object.keys(zip.files)).toEqual(['form.xml'])
  })
})
