/**
 * write-excel-file adapter — the ONLY module allowed to import it. All
 * cells are written as text so values like '007' or '20260709' round-trip
 * byte-identically through the reader's force-text coercion.
 */

export interface SheetSpec {
  name: string
  rows: string[][]
}

export const writeWorkbook = async (sheets: SheetSpec[]): Promise<Uint8Array> => {
  const data = sheets.map((sheet) => ({
    sheet: sheet.name,
    data: sheet.rows.map((row) =>
      row.map((cell) => (cell === '' ? null : { type: String, value: cell }))),
  }))
  if (typeof window === 'undefined') {
    // Never executed in the browser; @vite-ignore keeps the node-only build
    // (node:fs/node:stream imports) out of the app bundle graph.
    const { default: writeXlsxFile } = await import(/* @vite-ignore */ 'write-excel-file/node')
    const buffer = await writeXlsxFile(data).toBuffer()
    return new Uint8Array(buffer)
  }
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const blob = await writeXlsxFile(data).toBlob()
  return new Uint8Array(await blob.arrayBuffer())
}
