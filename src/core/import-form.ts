import { classifyZip, parseFormBundleZip } from './import-zip'
import { normalizeDefaultContent } from './model/translations'
import type { FormDocument } from './model/types'
import type { ArchiveAttachment } from './workspace/archive'
import { parseXForm } from './xform/parser'
import { readXlsForm } from './xlsform/reader'
import type { Issue } from './validate/issues'

export type ImportKind = 'xform' | 'xlsform'

export interface ImportParseResult {
  kind: ImportKind
  document: FormDocument | null
  issues: Issue[]
  /** Present only for ZIP bundle imports (media/<filename> blobs alongside the
   * parsed document). Absent/undefined for bare .xml/.xlsx files. */
  attachments?: ArchiveAttachment[]
}

/** Imported files may mix bare/default text with named languages; merge it
 * into the primary language at the boundary so the builder only ever sees
 * the clean shapes (no-op on clean docs, conflict cells kept). */
const normalized = (document: FormDocument | null): FormDocument | null => {
  if (document !== null) normalizeDefaultContent(document)
  return document
}

/** Dispatches an uploaded file to the right parser by extension/content:
 * XForm (.xml), XLSForm (.xlsx/.xls) or a form ZIP bundle (.zip, produced by
 * `exportZip` — `form.xml`/`form.xlsx` plus `media/<filename>`). */
export const parseFormFile = async (file: File): Promise<ImportParseResult> => {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const { document, issues } = await readXlsForm(await file.arrayBuffer())
    return { kind: 'xlsform', document: normalized(document), issues }
  }
  if (name.endsWith('.xml')) {
    const { document, issues } = parseXForm(await file.text())
    return { kind: 'xform', document: normalized(document), issues }
  }
  // The bundle parser normalizes internally (it assembles the finished doc,
  // like central/import.ts), so its result is returned as-is.
  if (name.endsWith('.zip')) {
    return await parseFormBundleZip(await file.arrayBuffer())
  }
  // Sniff: XML files start with '<'; xlsx and zip bundles are both zips ('PK').
  const buffer = await file.arrayBuffer()
  const head = new Uint8Array(buffer.slice(0, 2))
  if (head[0] === 0x50 && head[1] === 0x4b) {
    if (await classifyZip(buffer) !== 'other') {
      return await parseFormBundleZip(buffer)
    }
    const { document, issues } = await readXlsForm(buffer)
    return { kind: 'xlsform', document: normalized(document), issues }
  }
  const text = await file.text()
  if (text.trimStart().startsWith('<')) {
    const { document, issues } = parseXForm(text)
    return { kind: 'xform', document: normalized(document), issues }
  }
  return {
    kind: 'xform',
    document: null,
    issues: [{
      severity: 'error',
      code: 'import.unsupported-file',
      message: `"${file.name}" is not an XForm (.xml), XLSForm (.xlsx) or form ZIP file.`,
      scope: {},
    }],
  }
}
