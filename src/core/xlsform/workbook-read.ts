/**
 * SheetJS adapter — the ONLY module allowed to import 'xlsx'. Everything
 * downstream works on plain string[][] rows, so the reading library can be
 * swapped behind this one file.
 *
 * All cells are force-coerced to text via the formatted value (raw: false):
 * numeric-looking strings like '20260709' or '007' must survive verbatim
 * and never come back as 2.0260709e7 / 7.
 */
import * as XLSX from 'xlsx'

export interface RawSheet {
  /** Original sheet name. */
  name: string
  /** Dense rows, every cell a trimmed string ('' for blanks). */
  rows: string[][]
}

export interface RawWorkbook {
  /** Keyed by trimmed, lowercased sheet name. */
  sheets: Map<string, RawSheet>
}

const sheetRows = (ws: XLSX.WorkSheet): string[][] => {
  const ref = ws['!ref']
  if (ref === undefined) return []
  // Anchor the range at A1 so array indexes line up with Excel row numbers
  // even when the used range starts below/right of the first cell.
  const range = XLSX.utils.decode_range(ref)
  range.s.r = 0
  range.s.c = 0
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: true,
    range,
  })
  return raw.map((row) => row.map((cell) => String(cell ?? '').trim()))
}

export const readWorkbook = (data: ArrayBuffer): RawWorkbook => {
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array' })
  const sheets = new Map<string, RawSheet>()
  for (const name of workbook.SheetNames) {
    const ws = workbook.Sheets[name]
    if (ws === undefined) continue
    sheets.set(name.trim().toLowerCase(), { name, rows: sheetRows(ws) })
  }
  return { sheets }
}
