/**
 * The official 591KB "ODK XLSForm Template" must import cleanly: its
 * survey/choices sheets are empty scaffolds and its eight emoji-named
 * documentation sheets must be preserved verbatim as extra sheets.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { readXlsForm } from '../../src/core/xlsform/reader'
import { writeXlsForm } from '../../src/core/xlsform/writer'

const templatePath = fileURLToPath(new URL('../fixtures/ODK XLSForm Template.xlsx', import.meta.url))

const load = (): ArrayBuffer => {
  const buf = readFileSync(templatePath)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

describe('ODK XLSForm Template.xlsx', () => {
  it('reads without errors or warnings', async () => {
    const { document, issues } = await readXlsForm(load())
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(issues.filter((i) => i.severity === 'warning')).toEqual([])
    expect(document.settings.version).not.toBe('')
    // The template ships documentation sheets that must survive round-trips.
    expect(Object.keys(document.unknown?.extraSheets ?? {}).length).toBeGreaterThanOrEqual(8)
  })

  it('survives a write → read round-trip including emoji sheet names', async () => {
    const first = await readXlsForm(load())
    const bytes = await writeXlsForm(first.document)
    const second = await readXlsForm(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    )
    expect(second.issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(Object.keys(second.document.unknown?.extraSheets ?? {}))
      .toEqual(Object.keys(first.document.unknown?.extraSheets ?? {}))
    expect(second.document.settings).toEqual(first.document.settings)
  })
})
