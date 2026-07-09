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
})
