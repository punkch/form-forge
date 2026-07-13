/**
 * DTOs and the typed transport error for the ODK Central client.
 *
 * Pure — no Vue/Pinia/Dexie/vue-i18n imports. Every value read off a parsed
 * Central JSON response is run through a defensive coercer (mirroring
 * `coerceMeta` in src/core/workspace/archive.ts) so the rest of the codebase
 * only ever sees well-typed shapes, never raw `unknown` from the network.
 *
 * Transport/API failures are modelled as `CentralError` (a typed `kind`
 * discriminant + status/code/details), NOT as a validate `Issue`: an `Issue`'s
 * `message` is rendered verbatim and is form-node-scoped, which is the wrong
 * shape for a network error. The UI maps `CentralError.kind` to localized copy;
 * core never localizes.
 */
import { isRecord } from '../util/guards'

/** The kinds of Central transport/API failures the UI branches on.
 *
 * - `cors` / `network` — the two ways `fetch` itself rejects; they are
 *   indistinguishable at the network layer, so they are told apart by the
 *   `navigator.onLine` heuristic in client.ts.
 * - `auth` — 401/403.
 * - `conflict` — 409 (carries Central's `code`, e.g. `'409.3'`, and `details`).
 * - `not-found` — 404.
 * - `http` — any other non-OK status.
 */
export type CentralErrorKind =
  | 'cors'
  | 'network'
  | 'auth'
  | 'http'
  | 'conflict'
  | 'not-found'

export interface CentralErrorInit {
  kind: CentralErrorKind
  /** HTTP status, when the failure came from a resolved non-OK response. */
  status?: number
  /** Central's structured error code (e.g. `'409.3'` on a formId collision). */
  code?: string
  /** Central's error `details` payload passed through verbatim. */
  details?: unknown
}

/**
 * A Central transport/API error. Mirrors `XmlParseError`
 * (src/core/xform/xml-reader.ts) but carries a `kind` discriminant plus the
 * HTTP status / Central `code` / `details` the store and UI branch on.
 */
export class CentralError extends Error {
  readonly kind: CentralErrorKind
  readonly status?: number
  readonly code?: string
  readonly details?: unknown

  constructor (message: string, init: CentralErrorInit) {
    super(message)
    this.name = 'CentralError'
    this.kind = init.kind
    this.status = init.status
    this.code = init.code
    this.details = init.details
  }
}

/** `POST /v1/sessions` result. The token is the session bearer token; `csrf`
 * and `expiresAt` are informational and may be absent. */
export interface CentralSession {
  token: string
  csrf?: string
  expiresAt?: string
}

/** A project from `GET /v1/projects`. `verbs` gates Publish in the store
 * (`form.create` / `form.update`). */
export interface CentralProject {
  id: number
  name: string
  verbs: string[]
}

/** A form summary from `GET .../:id/forms`. `publishedAt` is `null` for a
 * never-published draft — the import picker filters those out. */
export interface CentralFormSummary {
  xmlFormId: string
  name?: string
  version?: string
  publishedAt: string | null
}

/** An attachment descriptor from `.../attachments`. `exists:false` marks an
 * expected-but-not-yet-uploaded attachment. */
export interface CentralAttachmentDescriptor {
  name: string
  type?: string
  hash?: string
  exists: boolean
}

/** Defensively coerce a parsed `POST /v1/sessions` body. A missing token
 * defaults to `''` (the caller's auth then fails cleanly) rather than throwing,
 * matching the `coerceMeta` "safe defaults" contract. */
export const coerceSession = (raw: unknown): CentralSession => {
  const r = isRecord(raw) ? raw : {}
  return {
    token: typeof r.token === 'string' ? r.token : '',
    csrf: typeof r.csrf === 'string' ? r.csrf : undefined,
    expiresAt: typeof r.expiresAt === 'string' ? r.expiresAt : undefined,
  }
}

export const coerceProject = (raw: unknown): CentralProject => {
  const r = isRecord(raw) ? raw : {}
  return {
    id: typeof r.id === 'number' ? r.id : 0,
    name: typeof r.name === 'string' ? r.name : '',
    verbs: Array.isArray(r.verbs) ? r.verbs.filter((v): v is string => typeof v === 'string') : [],
  }
}

export const coerceFormSummary = (raw: unknown): CentralFormSummary => {
  const r = isRecord(raw) ? raw : {}
  return {
    xmlFormId: typeof r.xmlFormId === 'string' ? r.xmlFormId : '',
    name: typeof r.name === 'string' ? r.name : undefined,
    version: typeof r.version === 'string' ? r.version : undefined,
    publishedAt: typeof r.publishedAt === 'string' ? r.publishedAt : null,
  }
}

export const coerceAttachmentDescriptor = (raw: unknown): CentralAttachmentDescriptor => {
  const r = isRecord(raw) ? raw : {}
  return {
    name: typeof r.name === 'string' ? r.name : '',
    type: typeof r.type === 'string' ? r.type : undefined,
    hash: typeof r.hash === 'string' ? r.hash : undefined,
    exists: r.exists === true,
  }
}

/** Coerce an untrusted value that should be an array; a non-array yields `[]`. */
const coerceList = <T>(raw: unknown, coerce: (item: unknown) => T): T[] =>
  Array.isArray(raw) ? raw.map((item) => coerce(item)) : []

export const coerceProjectList = (raw: unknown): CentralProject[] =>
  coerceList(raw, coerceProject)

export const coerceFormSummaryList = (raw: unknown): CentralFormSummary[] =>
  coerceList(raw, coerceFormSummary)

export const coerceAttachmentDescriptorList = (raw: unknown): CentralAttachmentDescriptor[] =>
  coerceList(raw, coerceAttachmentDescriptor)
