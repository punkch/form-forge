/**
 * Workspace archive container: a plain zip holding every exported form's
 * document, metadata and attachment blobs, described by a manifest.
 *
 * Layout (formatVersion 1):
 *
 *   manifest.json                            { formatVersion, exportedAt, appVersion, forms }
 *   forms/<recordId>/form.json               FormDocument (JSON)
 *   forms/<recordId>/meta.json               { title, formId, version, createdAt, updatedAt }
 *   forms/<recordId>/attachments/<filename>  raw blobs
 *
 * Pure logic — no Dexie/Vue imports; persistence wiring lives in
 * src/persistence/workspace-io.ts. `manifest.formatVersion` versions this
 * container; each form document is additionally versioned by its own
 * `schemaVersion` and passes through migrateDoc on read.
 */
import JSZip from 'jszip'

import { migrateDoc } from '../model/migrate'
import type { FormDocument } from '../model/types'
import { isRecord } from '../util/guards'
import { error } from '../validate/issues'
import type { Issue } from '../validate/issues'

export const WORKSPACE_FORMAT_VERSION = 1

export interface ArchiveFormMeta {
  title: string
  formId: string
  version: string
  /** Absent when a read archive's meta.json carried no finite timestamp;
   * the import side defaults createdAt to the import time. */
  createdAt?: number
  updatedAt?: number
}

/** Fallback mediatype for attachments that carry no usable `Content-Type`. */
export const DEFAULT_MEDIATYPE = 'application/octet-stream'

export interface ArchiveAttachment {
  filename: string
  mediatype: string
  blob: Blob
}

export interface ArchiveFormInput {
  recordId: string
  meta: ArchiveFormMeta
  doc: FormDocument
  attachments: ArchiveAttachment[]
}

/** A form read back from an archive; same shape the build side takes in. */
export type ParsedArchiveForm = ArchiveFormInput

export interface ReadWorkspaceArchiveResult {
  forms: ParsedArchiveForm[]
  issues: Issue[]
}

/** Coerce an untrusted meta.json into ArchiveFormMeta: strings default to '',
 * non-finite timestamps are dropped so a crafted `createdAt` can never reach
 * a FormRecord (the import side defaults it instead). */
const coerceMeta = (raw: unknown): ArchiveFormMeta => {
  const m = isRecord(raw) ? raw : {}
  const str = (v: unknown): string => (typeof v === 'string' ? v : '')
  const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
  return {
    title: str(m.title),
    formId: str(m.formId),
    version: str(m.version),
    createdAt: num(m.createdAt),
    updatedAt: num(m.updatedAt),
  }
}

export const buildWorkspaceArchive = async (
  forms: ArchiveFormInput[],
  appVersion: string,
  exportedAt: string
): Promise<Uint8Array> => {
  const zip = new JSZip()
  const manifest = {
    formatVersion: WORKSPACE_FORMAT_VERSION,
    exportedAt,
    appVersion,
    forms: forms.map((f) => ({ recordId: f.recordId, formId: f.meta.formId, title: f.meta.title })),
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  for (const form of forms) {
    const base = `forms/${form.recordId}`
    zip.file(`${base}/form.json`, JSON.stringify(form.doc, null, 2))
    zip.file(`${base}/meta.json`, JSON.stringify(form.meta, null, 2))
    for (const att of form.attachments) {
      // JSZip reads the Blob lazily at generateAsync — no eager arrayBuffer copy.
      zip.file(`${base}/attachments/${att.filename}`, att.blob)
    }
  }
  return zip.generateAsync({ type: 'uint8array' })
}

const parseJsonFile = async (zip: JSZip, path: string): Promise<unknown> => {
  const file = zip.file(path)
  if (file === null) throw new Error(`missing ${path}`)
  return JSON.parse(await file.async('string'))
}

interface ReadFormResult {
  form: ParsedArchiveForm | null
  issues: Issue[]
}

const readForm = async (zip: JSZip, recordId: string): Promise<ReadFormResult> => {
  const base = `forms/${recordId}`
  const rawDoc = await parseJsonFile(zip, `${base}/form.json`)
  const meta = coerceMeta(await parseJsonFile(zip, `${base}/meta.json`))
  const { doc, issues } = migrateDoc(rawDoc)
  if (doc === null) return { form: null, issues }

  // Fetch each referenced blob by its exact path rather than scanning the whole
  // zip: refs whose entry is missing are skipped (the dangling ref is dropped
  // at import time), and the mimetype comes straight from the ref.
  const attachments: ArchiveAttachment[] = []
  for (const ref of doc.attachments) {
    const file = zip.file(`${base}/attachments/${ref.filename}`)
    if (file === null) continue
    const mediatype = ref.mediatype || DEFAULT_MEDIATYPE
    attachments.push({
      filename: ref.filename,
      mediatype,
      blob: new Blob([await file.async('uint8array') as BlobPart], { type: mediatype }),
    })
  }
  return { form: { recordId, meta, doc, attachments }, issues }
}

export const readWorkspaceArchive = async (data: ArrayBuffer): Promise<ReadWorkspaceArchiveResult> => {
  const issues: Issue[] = []
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(data)
  } catch {
    return {
      forms: [],
      issues: [error('workspace.invalid-archive', 'The file could not be read as a ZIP archive.')],
    }
  }

  let manifest: { formatVersion?: unknown, forms?: Array<{ recordId?: unknown }> }
  try {
    manifest = await parseJsonFile(zip, 'manifest.json') as typeof manifest
  } catch {
    return {
      forms: [],
      issues: [error(
        'workspace.not-an-archive',
        'No readable manifest.json found — this ZIP is not a workspace archive. ' +
        '(XLSForm .xlsx workbooks are also ZIP files; use "Import form" for those.)'
      )],
    }
  }

  if (typeof manifest.formatVersion !== 'number') {
    // A manifest.json without a numeric formatVersion is not one of ours.
    return {
      forms: [],
      issues: [error(
        'workspace.not-an-archive',
        'The manifest.json has no format version — this ZIP is not a workspace archive. ' +
        '(XLSForm .xlsx workbooks are also ZIP files; use "Import form" for those.)'
      )],
    }
  }
  if (manifest.formatVersion > WORKSPACE_FORMAT_VERSION) {
    return {
      forms: [],
      issues: [error(
        'workspace.format-version-unsupported',
        `The archive format version ${String(manifest.formatVersion)} is not supported ` +
        `(this app reads up to version ${WORKSPACE_FORMAT_VERSION}). ` +
        'It may have been exported by a newer version of the app.'
      )],
    }
  }

  const forms: ParsedArchiveForm[] = []
  for (const entry of Array.isArray(manifest.forms) ? manifest.forms : []) {
    const recordId = typeof entry.recordId === 'string' ? entry.recordId : null
    try {
      if (recordId === null) throw new Error('manifest entry has no recordId')
      const { form, issues: formIssues } = await readForm(zip, recordId)
      issues.push(...formIssues)
      if (form !== null) forms.push(form)
    } catch (err) {
      issues.push(error(
        'workspace.form-unreadable',
        `Form "${recordId ?? '?'}" could not be read from the archive and was skipped ` +
        `(${err instanceof Error ? err.message : String(err)}).`
      ))
    }
  }
  return { forms, issues }
}
