import type { FormDocument } from './model/types'
import { parseXForm } from './xform/parser'
import { readXlsForm } from './xlsform/reader'
import type { Issue } from './validate/issues'

export type ImportKind = 'xform' | 'xlsform'

export interface ImportParseResult {
  kind: ImportKind
  document: FormDocument | null
  issues: Issue[]
}

/** Dispatches an uploaded file to the right parser by extension/content. */
export const parseFormFile = async (file: File): Promise<ImportParseResult> => {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const { document, issues } = await readXlsForm(await file.arrayBuffer())
    return { kind: 'xlsform', document, issues }
  }
  if (name.endsWith('.xml')) {
    const { document, issues } = parseXForm(await file.text())
    return { kind: 'xform', document, issues }
  }
  // Sniff: XML files start with '<'; xlsx is a zip ('PK').
  const head = new Uint8Array((await file.arrayBuffer()).slice(0, 2))
  if (head[0] === 0x50 && head[1] === 0x4b) {
    const { document, issues } = await readXlsForm(await file.arrayBuffer())
    return { kind: 'xlsform', document, issues }
  }
  const text = await file.text()
  if (text.trimStart().startsWith('<')) {
    const { document, issues } = parseXForm(text)
    return { kind: 'xform', document, issues }
  }
  return {
    kind: 'xform',
    document: null,
    issues: [{
      severity: 'error',
      code: 'import.unsupported-file',
      message: `"${file.name}" is not an XForm (.xml) or XLSForm (.xlsx) file.`,
      scope: {},
    }],
  }
}
