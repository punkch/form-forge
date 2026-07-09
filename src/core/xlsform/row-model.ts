/**
 * Sheet-shaped intermediate model: raw string[][] rows become a SheetTable
 * with parsed header columns and 1-based Excel row numbers preserved for
 * issue reporting (header row = 1 in a well-formed sheet).
 */
import { DEFAULT_LANG, type Lang, type LocalizedText } from '../model/types'
import { parseHeader, type ParsedHeader } from './columns'

export interface TableColumn extends ParsedHeader {
  /** 0-based cell index within a row. */
  index: number
  /** Original header text, trimmed. */
  header: string
}

export interface TableRow {
  /** 1-based Excel row number (header = row 1). */
  rowNumber: number
  cells: string[]
}

export interface SheetTable {
  /** Original sheet name (not lowercased). */
  name: string
  /** 1-based row number of the header row. */
  headerRow: number
  columns: TableColumn[]
  /** Data rows with at least one non-empty cell. */
  rows: TableRow[]
}

/** Null when the sheet has no header row (entirely empty). */
export const buildTable = (name: string, rows: string[][], sheet?: string): SheetTable | null => {
  const headerIndex = rows.findIndex((row) => row.some((cell) => cell !== ''))
  if (headerIndex === -1) return null

  const columns: TableColumn[] = []
  rows[headerIndex].forEach((text, index) => {
    if (text === '') return
    columns.push({ index, header: text, ...parseHeader(text, sheet) })
  })

  const dataRows: TableRow[] = []
  rows.forEach((cells, i) => {
    if (i <= headerIndex) return
    if (cells.every((cell) => cell === '')) return
    dataRows.push({ rowNumber: i + 1, cells })
  })

  return { name, headerRow: headerIndex + 1, columns, rows: dataRows }
}

export const cellValue = (row: TableRow, column: TableColumn): string =>
  row.cells[column.index] ?? ''

/** Value of the first untranslated column with the given base ('' if none). */
export const plainValue = (table: SheetTable, row: TableRow, base: string): string => {
  const column = table.columns.find((c) => c.base === base && c.lang === undefined)
  return column === undefined ? '' : cellValue(row, column)
}

/** Folds base + base::Lang columns into a LocalizedText; empty cells are
 * skipped and undefined is returned when nothing is set. */
export const localizedValue = (table: SheetTable, row: TableRow, base: string): LocalizedText | undefined => {
  let out: LocalizedText | undefined
  for (const column of table.columns) {
    if (column.base !== base) continue
    const value = cellValue(row, column)
    if (value === '') continue
    out ??= {}
    out[column.lang ?? DEFAULT_LANG] = value
  }
  return out
}

/** Languages in header (left-to-right) order, deduplicated. */
export const collectLanguages = (tables: Array<SheetTable | null | undefined>, into: Lang[] = []): Lang[] => {
  for (const table of tables) {
    for (const column of table?.columns ?? []) {
      if (column.lang !== undefined && !into.includes(column.lang)) into.push(column.lang)
    }
  }
  return into
}
