/**
 * Parse a per-form ZIP bundle — the layout `exportZip` (`./export/zip.ts`)
 * produces: `form.xml` (native XForm) OR `form.xlsx` (XLSForm workbook) at
 * the root, plus `media/<filename>` for every attachment. No manifest, no
 * mediatype metadata — a bare export for round-tripping a single form.
 *
 * Pure core: no Vue/Pinia/Dexie/vue-i18n imports.
 *
 * `parseXForm` and `readXlsForm` leave `document.attachments = []`, so the
 * refs are rebuilt from the `media/` entries via the shared
 * `attachmentRefsFor` (mediatype inferred from extension, since a zip entry
 * carries no Content-Type of its own) — matching the shape the landing path
 * (`createFormWithArchiveAttachments`/`replaceFormWithArchiveAttachments`)
 * expects. This module also owns the import-boundary
 * `normalizeDefaultContent` call (like `central/import.ts`, it assembles the
 * finished document); `parseFormFile` returns its result untouched.
 */
import JSZip from 'jszip'

import type { ImportKind, ImportParseResult } from './import-form'
import { attachmentRefsFor, mediatypeFor } from './model/attachment-role'
import { normalizeDefaultContent } from './model/translations'
import type { FormDocument } from './model/types'
import { error, warning } from './validate/issues'
import type { Issue } from './validate/issues'
import type { ArchiveAttachment } from './workspace/archive'
import { parseXForm } from './xform/parser'
import { readXlsForm } from './xlsform/reader'

/** Direct children of `media/` only (skips nested subfolders and directory
 * entries) — matches what `exportZip` produces; anything else in the zip
 * (e.g. `__MACOSX/` junk) is ignored silently. */
const MEDIA_ENTRY = /^media\/[^/]+$/

/** Some Windows zip tools emit backslash separators (forbidden by the zip
 * spec, seen in the wild); JSZip keeps them as-is, so normalize before
 * matching or those media entries would silently vanish. */
const entryPath = (path: string): string => path.replace(/\\/g, '/')

/**
 * Classify an uploaded ZIP without fully parsing it: `'bundle'` (root
 * `form.xml`/`form.xlsx`), `'workspace-archive'` (root `manifest.json`,
 * belongs in Settings → Import workspace instead), or `'other'` (neither
 * marker present, or the bytes aren't a readable ZIP at all).
 */
export const classifyZip = async (data: ArrayBuffer): Promise<'bundle' | 'workspace-archive' | 'other'> => {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(data)
  } catch {
    return 'other'
  }
  if (zip.file('form.xml') !== null || zip.file('form.xlsx') !== null) return 'bundle'
  if (zip.file('manifest.json') !== null) return 'workspace-archive'
  return 'other'
}

const errorResult = (issue: Issue): ImportParseResult =>
  ({ kind: 'xform', document: null, issues: [issue] })

/** Root `form.xml` wins over `form.xlsx`; null when the zip holds neither. */
const readBundleForm = async (
  zip: JSZip
): Promise<{ kind: ImportKind, document: FormDocument, issues: Issue[] } | null> => {
  const xmlEntry = zip.file('form.xml')
  if (xmlEntry !== null) {
    const { document, issues } = parseXForm(await xmlEntry.async('string'))
    return { kind: 'xform', document, issues }
  }
  const xlsxEntry = zip.file('form.xlsx')
  if (xlsxEntry !== null) {
    const { document, issues } = await readXlsForm(await xlsxEntry.async('arraybuffer'))
    return { kind: 'xlsform', document, issues }
  }
  return null
}

/**
 * Parse a per-form ZIP bundle into the same `ImportParseResult` shape a bare
 * `.xml`/`.xlsx` import produces, plus the rebuilt `media/` attachment blobs.
 * Errors (unreadable zip, workspace archive, no form at all) return with
 * `document: null` and no `attachments` field.
 */
export const parseFormBundleZip = async (data: ArrayBuffer): Promise<ImportParseResult> => {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(data)
  } catch {
    return errorResult(error('import.invalid-zip', 'The file could not be read as a ZIP archive.'))
  }

  const form = await readBundleForm(zip)
  if (form === null) {
    // Only a form-less zip is probed for the workspace-archive marker: a real
    // bundle carrying a stray root manifest.json must still import as a bundle
    // (classifyZip applies the same precedence).
    if (zip.file('manifest.json') !== null) {
      return errorResult(error(
        'import.workspace-archive',
        'This is a Form Forge workspace archive. Import it from Settings → Import workspace.'
      ))
    }
    return errorResult(error(
      'import.zip-no-form',
      'The ZIP does not contain a form.xml or form.xlsx file at its root.'
    ))
  }

  const { kind, document } = form
  const issues = [...form.issues]
  if (kind === 'xform' && zip.file('form.xlsx') !== null) {
    issues.push(warning(
      'import.zip-both-forms',
      'The ZIP contains both form.xml and form.xlsx; form.xml was imported.'
    ))
  }

  // Import boundary: merge mixed default+named-language text into the primary
  // language (no-op on clean docs, conflict cells kept).
  normalizeDefaultContent(document)

  const attachments: ArchiveAttachment[] = []
  for (const [path, entry] of Object.entries(zip.files)) {
    const normalized = entryPath(path)
    if (entry.dir || !MEDIA_ENTRY.test(normalized)) continue
    const filename = normalized.slice('media/'.length)
    const mediatype = mediatypeFor(filename)
    const bytes = await entry.async('uint8array')
    attachments.push({ filename, mediatype, blob: new Blob([bytes as BlobPart], { type: mediatype }) })
  }
  document.attachments = attachmentRefsFor(attachments)

  return { kind, document, issues, attachments }
}
