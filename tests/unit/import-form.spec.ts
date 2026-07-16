import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { parseFormFile } from '@/core/import-form'

const fileOf = (name: string, data: string | Buffer, type = ''): File =>
  new File([data as BlobPart], name, { type })

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
