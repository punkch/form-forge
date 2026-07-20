/**
 * Workspace archive container: a plain zip holding every exported form's
 * document, metadata and attachment blobs, described by a manifest.
 *
 * Layout:
 *
 *   manifest.json                            { formatVersion, exportedAt, appVersion, forms, includesCredentials? }
 *   forms/<recordId>/form.json               FormDocument (JSON)
 *   forms/<recordId>/meta.json               { title, formId, version, createdAt, updatedAt }
 *   forms/<recordId>/attachments/<filename>  raw blobs
 *
 *   central/servers.json   ArchiveCentralServer[]  (formatVersion 2 only; encryptedPassword base64, omitted unless credentials opted in)
 *   central/targets.json   ArchivePublishTarget[]  (formatVersion 2 only)
 *   central/vault.json     ArchiveVault             (formatVersion 2, ONLY when credentials opted in; salt + keyCheck base64)
 *   templates.json         ArchiveTemplate[]        (formatVersion 2 only; the user's locally saved "Save as template" forms)
 *
 * `formatVersion` is **1** for a single-form / shareable export (never carries
 * a `central/` section — credential-free by construction) and **2** for a
 * whole-workspace backup (carries Central server config + publish targets, and
 * — only when the user opts in — the credential vault + saved passwords).
 *
 * Pure logic — no Dexie/Vue imports; persistence wiring lives in
 * src/persistence/workspace-io.ts. Crypto byte fields (Uint8Array) are encoded
 * browser-safe via a small base64 helper (no Buffer); plain JSON.stringify of a
 * Uint8Array is lossy and must never be used for them. Each form document is
 * additionally versioned by its own `schemaVersion` and passes through
 * migrateDoc on read.
 */
import JSZip from 'jszip'

import type { EncryptedBlob } from '../central/vault'
import { DEFAULT_MEDIATYPE } from '../model/attachment-role'
import { migrateDoc } from '../model/migrate'
import type { FormDocument } from '../model/types'
import { isRecord } from '../util/guards'
import { error, warning } from '../validate/issues'
import type { Issue } from '../validate/issues'

/** Highest container version this build reads and writes. */
export const WORKSPACE_FORMAT_VERSION = 2
/**
 * Version stamped on a single-form / shareable export. It never carries a
 * `central/` section, so an older app build (which reads only up to v1) can
 * still open a shared form.
 */
export const SHARE_FORMAT_VERSION = 1

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
export { DEFAULT_MEDIATYPE }

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

/**
 * ODK Central section of a whole-workspace backup (formatVersion 2). Shapes are
 * defined here (in pure core) rather than imported from persistence so
 * `archive.ts` stays Dexie-free; the persistence records
 * (`CentralServerRecord`/`PublishTargetRecord`/`CentralVaultRecord`) are
 * structurally assignable to these. `encryptedPassword`/`vault` are present only
 * when the user opted to include saved credentials.
 */
export interface ArchiveCentralServer {
  id: string
  name: string
  baseUrl: string
  email?: string
  encryptedPassword?: EncryptedBlob
}

export interface ArchivePublishTarget {
  id: string
  formRecordId: string
  serverId: string
  projectId: number
  xmlFormId: string
  lastPublishedVersion: string
  lastPublishedAt: number
  lastPublishedContentHash?: string
}

export interface ArchiveVault {
  salt: Uint8Array
  keyCheck: EncryptedBlob
}

export interface ArchiveCentralData {
  servers: ArchiveCentralServer[]
  targets: ArchivePublishTarget[]
  /** Present only when the user opted to include saved credentials on export. */
  vault?: ArchiveVault
}

/**
 * Persisted device-level UI preferences (theme, accent, interface language,
 * panel widths, …) carried by a whole-workspace backup. Non-secret. The archive
 * treats it as an opaque JSON object — the shape is owned and validated by the
 * ui store; core never interprets it.
 */
export type ArchivePreferences = Record<string, unknown>

/**
 * A locally saved "Save as template" form carried by a whole-workspace backup.
 * Structurally the persistence `TemplateRecord` (which pure core must not
 * import). Template docs never carry attachment blobs — `doc.attachments` is
 * always empty (see persistence/templates-repo). Non-secret and workspace-level,
 * so — like the Central section — it belongs only in the whole-workspace backup,
 * never in a single-form share.
 */
export interface ArchiveTemplate {
  id: string
  title: string
  description: string
  questionCount: number
  preview: string[]
  createdAt: number
  updatedAt: number
  doc: FormDocument
}

/**
 * The whole-workspace-only sections a backup carries beyond forms + attachments.
 * Passing this to `buildWorkspaceArchive` makes the archive a **format-2 backup**
 * (`central/` always; `preferences.json` / `templates.json` when non-empty);
 * omitting it yields a **format-1 share** (forms only, credential-free by
 * construction).
 */
export interface WorkspaceBackupSections {
  central: ArchiveCentralData
  preferences?: ArchivePreferences
  /** Locally saved templates. Absent or empty ⇒ no `templates.json` is written. */
  templates?: ArchiveTemplate[]
}

export interface ReadWorkspaceArchiveResult {
  forms: ParsedArchiveForm[]
  issues: Issue[]
  /** Present when a v2 backup carried a `central/` section (undefined for a v1
   * share, or when the section was absent/unreadable). */
  central?: ArchiveCentralData
  /** Persisted UI preferences from a v2 backup's `preferences.json` (undefined
   * for a v1 share, or when absent/unreadable). */
  preferences?: ArchivePreferences
  /** Locally saved templates from a v2 backup's `templates.json` (undefined for
   * a v1 share, or when absent/unreadable; empty array when the file was present
   * but held no valid entries). */
  templates?: ArchiveTemplate[]
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

/** Base64 of raw bytes, browser-safe (no Buffer). Small credential blobs only,
 * so the per-char string build is fine. */
const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

const base64ToBytes = (b64: string): Uint8Array => {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** On-disk (JSON) encoding of an EncryptedBlob: both byte fields base64. */
interface WireEncryptedBlob { iv: string, ciphertext: string }
interface WireServer { id: string, name: string, baseUrl: string, email?: string, encryptedPassword?: WireEncryptedBlob }
interface WireVault { salt: string, keyCheck: WireEncryptedBlob }

const encodeBlob = (blob: EncryptedBlob): WireEncryptedBlob =>
  ({ iv: bytesToBase64(blob.iv), ciphertext: bytesToBase64(blob.ciphertext) })

/** Write the `central/` section. servers + targets always; vault only when
 * credentials were opted in (`central.vault` present). */
const writeCentral = (zip: JSZip, central: ArchiveCentralData): void => {
  const servers: WireServer[] = central.servers.map((s) => ({
    id: s.id,
    name: s.name,
    baseUrl: s.baseUrl,
    ...(s.email === undefined ? {} : { email: s.email }),
    ...(s.encryptedPassword === undefined ? {} : { encryptedPassword: encodeBlob(s.encryptedPassword) }),
  }))
  zip.file('central/servers.json', JSON.stringify(servers, null, 2))
  zip.file('central/targets.json', JSON.stringify(central.targets, null, 2))
  if (central.vault !== undefined) {
    const vault: WireVault = { salt: bytesToBase64(central.vault.salt), keyCheck: encodeBlob(central.vault.keyCheck) }
    zip.file('central/vault.json', JSON.stringify(vault, null, 2))
  }
}

/**
 * Build a workspace archive. With no `backup` argument this is a single-form /
 * shareable export: formatVersion 1, no `central/` section, byte-identical to
 * the pre-v2 output. With `backup` provided it is a whole-workspace backup:
 * formatVersion 2 — `central/servers.json` + `central/targets.json` always,
 * `central/vault.json` only when credentials were opted in, and
 * `preferences.json` when device UI preferences are included.
 */
export const buildWorkspaceArchive = async (
  forms: ArchiveFormInput[],
  appVersion: string,
  exportedAt: string,
  backup?: WorkspaceBackupSections
): Promise<Uint8Array> => {
  const zip = new JSZip()
  const manifest: Record<string, unknown> = {
    formatVersion: backup === undefined ? SHARE_FORMAT_VERSION : WORKSPACE_FORMAT_VERSION,
    exportedAt,
    appVersion,
    forms: forms.map((f) => ({ recordId: f.recordId, formId: f.meta.formId, title: f.meta.title })),
  }
  // Only a v2 backup advertises credential inclusion; keeping this key off the
  // share path preserves its byte-identical output.
  if (backup !== undefined) manifest.includesCredentials = backup.central.vault !== undefined
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
  if (backup !== undefined) {
    writeCentral(zip, backup.central)
    if (backup.preferences !== undefined) {
      zip.file('preferences.json', JSON.stringify(backup.preferences, null, 2))
    }
    // Omit the file entirely when there are no templates, so an empty gallery
    // never adds a stray (and confusing) empty section to the archive.
    if (backup.templates !== undefined && backup.templates.length > 0) {
      zip.file('templates.json', JSON.stringify(backup.templates, null, 2))
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

/** Decode a wire EncryptedBlob back to bytes; undefined if malformed. */
const coerceWireBlob = (raw: unknown): EncryptedBlob | undefined => {
  if (!isRecord(raw)) return undefined
  const { iv, ciphertext } = raw
  if (typeof iv !== 'string' || typeof ciphertext !== 'string') return undefined
  // atob throws on non-base64 input; a single corrupt blob must skip its own
  // entry, not blow up the whole central section.
  try {
    return { iv: base64ToBytes(iv), ciphertext: base64ToBytes(ciphertext) }
  } catch {
    return undefined
  }
}

const coerceServers = (raw: unknown): ArchiveCentralServer[] => {
  if (!Array.isArray(raw)) return []
  const out: ArchiveCentralServer[] = []
  for (const r of raw) {
    if (!isRecord(r) || typeof r.id !== 'string' || typeof r.name !== 'string' || typeof r.baseUrl !== 'string') continue
    const server: ArchiveCentralServer = { id: r.id, name: r.name, baseUrl: r.baseUrl }
    if (typeof r.email === 'string') server.email = r.email
    const blob = coerceWireBlob(r.encryptedPassword)
    if (blob !== undefined) server.encryptedPassword = blob
    out.push(server)
  }
  return out
}

const coerceTargets = (raw: unknown): ArchivePublishTarget[] => {
  if (!Array.isArray(raw)) return []
  const out: ArchivePublishTarget[] = []
  for (const r of raw) {
    if (!isRecord(r)) continue
    if (typeof r.id !== 'string' || typeof r.formRecordId !== 'string' || typeof r.serverId !== 'string') continue
    if (typeof r.projectId !== 'number' || typeof r.xmlFormId !== 'string') continue
    const target: ArchivePublishTarget = {
      id: r.id,
      formRecordId: r.formRecordId,
      serverId: r.serverId,
      projectId: r.projectId,
      xmlFormId: r.xmlFormId,
      lastPublishedVersion: typeof r.lastPublishedVersion === 'string' ? r.lastPublishedVersion : '',
      lastPublishedAt: typeof r.lastPublishedAt === 'number' && Number.isFinite(r.lastPublishedAt) ? r.lastPublishedAt : 0,
    }
    if (typeof r.lastPublishedContentHash === 'string') target.lastPublishedContentHash = r.lastPublishedContentHash
    out.push(target)
  }
  return out
}

const coerceVault = (raw: unknown): ArchiveVault | undefined => {
  if (!isRecord(raw) || typeof raw.salt !== 'string') return undefined
  const keyCheck = coerceWireBlob(raw.keyCheck)
  if (keyCheck === undefined) return undefined
  try {
    return { salt: base64ToBytes(raw.salt), keyCheck }
  } catch {
    return undefined
  }
}

/**
 * Read the optional `central/` section. Returns undefined for a v1 share (no
 * such files). Best-effort: a malformed section is skipped with a warning so
 * the forms still import.
 */
const readCentral = async (zip: JSZip, issues: Issue[]): Promise<ArchiveCentralData | undefined> => {
  const serversFile = zip.file('central/servers.json')
  if (serversFile === null) return undefined
  try {
    const servers = coerceServers(JSON.parse(await serversFile.async('string')))
    const targetsFile = zip.file('central/targets.json')
    const targets = targetsFile === null ? [] : coerceTargets(JSON.parse(await targetsFile.async('string')))
    const vaultFile = zip.file('central/vault.json')
    const vault = vaultFile === null ? undefined : coerceVault(JSON.parse(await vaultFile.async('string')))
    return { servers, targets, vault }
  } catch (err) {
    issues.push(warning(
      'workspace.central-unreadable',
      'The archive\'s Central section could not be read and was skipped ' +
      `(${err instanceof Error ? err.message : String(err)}).`
    ))
    return undefined
  }
}

/**
 * Coerce an untrusted `templates.json` array into ArchiveTemplate[]. Each entry
 * needs at least a string id/title and a migratable doc; the doc runs through
 * `migrateDoc` (like a form) and is stripped of any attachment refs (template
 * blobs never travel). Stored metadata is carried faithfully with safe
 * fallbacks; a single malformed entry is skipped, not fatal.
 */
const coerceTemplates = (raw: unknown): ArchiveTemplate[] => {
  if (!Array.isArray(raw)) return []
  const out: ArchiveTemplate[] = []
  for (const r of raw) {
    if (!isRecord(r) || typeof r.id !== 'string' || typeof r.title !== 'string') continue
    const { doc } = migrateDoc(r.doc)
    if (doc === null) continue
    doc.attachments = []
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
    out.push({
      id: r.id,
      title: r.title,
      description: typeof r.description === 'string' ? r.description : '',
      questionCount: num(r.questionCount),
      preview: Array.isArray(r.preview) ? r.preview.filter((p): p is string => typeof p === 'string') : [],
      createdAt: num(r.createdAt),
      updatedAt: num(r.updatedAt),
      doc,
    })
  }
  return out
}

/**
 * Read the optional `templates.json` (a v2 backup's locally saved templates).
 * Returns undefined for a v1 share or an absent file; an empty array when the
 * file was present but held no valid entries. Best-effort so a bad templates
 * blob never blocks the forms.
 */
const readTemplates = async (zip: JSZip, issues: Issue[]): Promise<ArchiveTemplate[] | undefined> => {
  const file = zip.file('templates.json')
  if (file === null) return undefined
  try {
    return coerceTemplates(JSON.parse(await file.async('string')))
  } catch (err) {
    issues.push(warning(
      'workspace.templates-unreadable',
      'The archive\'s saved templates could not be read and were skipped ' +
      `(${err instanceof Error ? err.message : String(err)}).`
    ))
    return undefined
  }
}

/**
 * Read the optional `preferences.json` (a v2 backup's device UI preferences).
 * Returns undefined for a v1 share or an absent/unreadable file; best-effort so
 * a bad preferences blob never blocks the forms.
 */
const readPreferences = async (zip: JSZip, issues: Issue[]): Promise<ArchivePreferences | undefined> => {
  const file = zip.file('preferences.json')
  if (file === null) return undefined
  try {
    const raw: unknown = JSON.parse(await file.async('string'))
    return isRecord(raw) ? raw : undefined
  } catch (err) {
    issues.push(warning(
      'workspace.preferences-unreadable',
      'The archive\'s saved preferences could not be read and were skipped ' +
      `(${err instanceof Error ? err.message : String(err)}).`
    ))
    return undefined
  }
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
  const central = await readCentral(zip, issues)
  const preferences = await readPreferences(zip, issues)
  const templates = await readTemplates(zip, issues)
  return { forms, issues, central, preferences, templates }
}
