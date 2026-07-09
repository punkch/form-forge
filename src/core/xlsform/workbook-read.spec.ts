import { describe, expect, it } from 'vitest'
// Test-only direct SheetJS use: builds workbooks with real *numeric* cells
// to prove the reader's force-text coercion. Production code must go
// through the workbook-read adapter.
import * as XLSX from 'xlsx'

import { readWorkbook } from './workbook-read'
import { writeWorkbook } from './workbook-write'

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

describe('readWorkbook text coercion', () => {
  it('keeps numeric-looking values verbatim', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['version', 'code', 'price'],
      [20260709, '007', 1.5],
    ])
    // Give the price cell an explicit 2-decimal display format.
    const price = ws[XLSX.utils.encode_cell({ r: 1, c: 2 })]
    price.z = '0.00'
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'survey')
    const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

    const { sheets } = readWorkbook(data)
    const rows = sheets.get('survey')?.rows
    expect(rows?.[1]).toEqual(['20260709', '007', '1.50'])
  })

  it('lowercases sheet keys but keeps original names', () => {
    const ws = XLSX.utils.aoa_to_sheet([['type']])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Survey')
    const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const { sheets } = readWorkbook(data)
    expect(sheets.get('survey')?.name).toBe('Survey')
  })

  it('preserves Excel row numbers across blank rows', () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['type', 'name'],
      [],
      ['text', 'a'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'survey')
    const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
    const rows = readWorkbook(data).sheets.get('survey')?.rows
    expect(rows?.[2]?.[0]).toBe('text') // index 2 → Excel row 3
  })

  it('round-trips text through the write adapter', async () => {
    const bytes = await writeWorkbook([
      { name: 'survey', rows: [['type', 'name', 'default'], ['text', 'a', '20260709'], ['text', 'b', '007']] },
    ])
    const { sheets } = readWorkbook(toArrayBuffer(bytes))
    expect(sheets.get('survey')?.rows).toEqual([
      ['type', 'name', 'default'],
      ['text', 'a', '20260709'],
      ['text', 'b', '007'],
    ])
  })
})
