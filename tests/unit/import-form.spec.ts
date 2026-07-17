import { readFileSync } from 'node:fs'

import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { parseFormFile } from '@/core/import-form'

const fileOf = (name: string, data: string | Buffer | Uint8Array, type = ''): File =>
  new File([data as BlobPart], name, { type })

/** Minimal zip bundle matching what `exportZip` produces: `form.xml` at the
 * root (no media/ entries — an empty attachments array is fine). */
const bundleZipBytes = async (): Promise<Uint8Array> => {
  const xml = readFileSync('tests/golden/expected/basic.xml', 'utf8')
  const zip = new JSZip()
  zip.file('form.xml', xml)
  return zip.generateAsync({ type: 'uint8array' })
}

describe('parseFormFile', () => {
  it('routes .xml to the XForm parser', async () => {
    const xml = readFileSync('tests/golden/expected/basic.xml', 'utf8')
    const result = await parseFormFile(fileOf('basic.xml', xml))
    expect(result.kind).toBe('xform')
    expect(result.document?.settings.formId).toBe('basic_test')
  })

  it('routes .xlsx to the XLSForm reader', async () => {
    const xlsx = readFileSync('tests/golden/src/basic.xlsx')
    const result = await parseFormFile(fileOf('basic.xlsx', xlsx))
    expect(result.kind).toBe('xlsform')
    expect(result.document?.settings.formId).toBe('basic_test')
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([])
  })

  it('sniffs content when the extension is missing', async () => {
    const xml = readFileSync('tests/golden/expected/basic.xml', 'utf8')
    expect((await parseFormFile(fileOf('form-download', xml))).kind).toBe('xform')

    const xlsx = readFileSync('tests/golden/src/basic.xlsx')
    expect((await parseFormFile(fileOf('workbook-download', xlsx))).kind).toBe('xlsform')
  })

  it('rejects unsupported files with a single clear error', async () => {
    const result = await parseFormFile(fileOf('notes.txt', 'plain text'))
    expect(result.document).toBeNull()
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0].code).toBe('import.unsupported-file')
    expect(result.issues[0].message).toContain('not an XForm')
  })

  it('routes .zip to the bundle parser', async () => {
    const bytes = await bundleZipBytes()
    const result = await parseFormFile(fileOf('bundle.zip', bytes))
    expect(result.kind).toBe('xform')
    expect(result.document).not.toBeNull()
    expect(result.document?.settings.formId).toBe('basic_test')
    expect(result.attachments).toEqual([])
  })

  it('sniffs an extensionless bundle zip', async () => {
    const bytes = await bundleZipBytes()
    const result = await parseFormFile(fileOf('bundle-download', bytes))
    expect(result.kind).toBe('xform')
    expect(result.document).not.toBeNull()
    expect(result.document?.settings.formId).toBe('basic_test')
  })

  it('sniffs an extensionless workspace archive and rejects it with the Settings pointer', async () => {
    const zip = new JSZip()
    zip.file('manifest.json', '{"formatVersion":2,"forms":[]}')
    const bytes = await zip.generateAsync({ type: 'uint8array' })
    const result = await parseFormFile(fileOf('archive-download', bytes))
    expect(result.document).toBeNull()
    expect(result.issues.map((i) => i.code)).toContain('import.workspace-archive')
  })

  it('still sniffs an extensionless real .xlsx as xlsform (sniff-branch regression guard)', async () => {
    const xlsx = readFileSync('tests/golden/src/basic.xlsx')
    const result = await parseFormFile(fileOf('workbook-download', xlsx))
    expect(result.kind).toBe('xlsform')
    expect(result.document).not.toBeNull()
    expect(result.document?.settings.formId).toBe('basic_test')
    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([])
  })

  it('normalizes an XForm mixing inline labels with itext languages', async () => {
    // /data/name has only an inline label (parsed under the default sentinel);
    // /data/age is itext-only. Normalization at the import boundary moves the
    // inline text into the primary named language.
    const xml = `<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa">
  <h:head>
    <h:title>Mixed</h:title>
    <model>
      <itext>
        <translation lang="French (fr)" default="true()">
          <text id="/data/age:label"><value>Votre âge ?</value></text>
        </translation>
      </itext>
      <instance>
        <data id="mixed_test" version="1">
          <name/>
          <age/>
        </data>
      </instance>
      <bind nodeset="/data/name" type="string"/>
      <bind nodeset="/data/age" type="int"/>
    </model>
  </h:head>
  <h:body>
    <input ref="/data/name"><label>Your name?</label></input>
    <input ref="/data/age"><label ref="jr:itext('/data/age:label')"/></input>
  </h:body>
</h:html>`
    const result = await parseFormFile(fileOf('mixed.xml', xml))
    expect(result.kind).toBe('xform')
    expect(result.document?.languages).toEqual(['French (fr)'])
    const labels = result.document?.children.map((n) => n.label)
    expect(labels).toEqual([
      { 'French (fr)': 'Your name?' },
      { 'French (fr)': 'Votre âge ?' },
    ])
  })
})
