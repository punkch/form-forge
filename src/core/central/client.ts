/**
 * Thin, injectable, typed `fetch` wrapper for the ODK Central REST API — the
 * only networked code in the product.
 *
 * Follows the "isolate the risky dependency behind a seam" pattern: like
 * `makeFetchFormAttachment` (src/preview/fetchFormAttachment.ts), the client is
 * a factory over an injectable `fetchImpl`, so unit tests drive it with canned
 * `Response` objects and never touch the network.
 *
 * Design constraints (see the plan):
 * - Pure core: no Vue/Pinia/Dexie/vue-i18n imports.
 * - Stateless re: auth — the session token is passed per call and sent as
 *   `Authorization: Bearer <token>`; the store owns token lifetime.
 * - The base URL is treated as opaque (may carry a path prefix, e.g.
 *   `http://localhost:8123/my-central`); we only trim trailing slashes and
 *   append `/v1/...`, never parse or reassemble host/path.
 */
import {
  CentralError,
  coerceAttachmentDescriptorList,
  coerceFormSummaryList,
  coerceProjectList,
  coerceSession,
} from './types'
import type {
  CentralAttachmentDescriptor,
  CentralErrorKind,
  CentralFormSummary,
  CentralProject,
  CentralSession,
} from './types'
import { coercePublishOutcome, type PublishOutcome } from './publish'
import { isRecord } from '../util/guards'

export interface CreateCentralClientOptions {
  /** Opaque server base URL; a path prefix is preserved. */
  baseUrl: string
  /**
   * Injectable `fetch`. Defaults to the global bound to `globalThis` — the
   * `bind` is mandatory, an unbound `fetch` throws "Illegal invocation" in
   * browsers. Tests inject a fake returning canned `Response`s.
   */
  fetchImpl?: typeof fetch
}

export interface CentralClient {
  /** `POST /v1/sessions` — exchange credentials for a bearer token. */
  createSession (email: string, password: string): Promise<CentralSession>
  /** `DELETE /v1/sessions/:token` — invalidate the session. */
  deleteSession (token: string): Promise<void>
  /** `GET /v1/projects` — projects the account can see (with `verbs`). */
  listProjects (token: string): Promise<CentralProject[]>
  /** `GET /v1/projects/:id/forms` — includes never-published (`publishedAt:null`) forms. */
  listForms (token: string, projectId: number): Promise<CentralFormSummary[]>
  /** `GET .../forms/:xmlFormId.xml` — the published XForm definition. */
  getPublishedFormXml (token: string, projectId: number, xmlFormId: string): Promise<string>
  /** `GET .../forms/:xmlFormId/draft.xml` — the current draft's XForm definition. */
  getDraftFormXml (token: string, projectId: number, xmlFormId: string): Promise<string>
  /** `GET .../forms/:xmlFormId/attachments` — published attachment descriptors. */
  listPublishedAttachments (token: string, projectId: number, xmlFormId: string): Promise<CentralAttachmentDescriptor[]>
  /** `GET .../forms/:xmlFormId/attachments/:name` — a published attachment blob. */
  downloadPublishedAttachment (token: string, projectId: number, xmlFormId: string, name: string): Promise<Blob>
  /** `POST .../forms?ignoreWarnings=true&publish=false` — create a form (as a
   * draft), resolving the parsed response body (Central's `warnings`, if any). A
   * formId collision surfaces as `CentralError{kind:'conflict', code:'409.3'}`. */
  createForm (token: string, projectId: number, xml: string): Promise<PublishOutcome>
  /** `POST .../forms/:xmlFormId/draft?ignoreWarnings=true` — replace the draft
   * definition, resolving the parsed response body (Central's `warnings`, if any). */
  updateDraft (token: string, projectId: number, xmlFormId: string, xml: string): Promise<PublishOutcome>
  /** `POST .../forms/:xmlFormId/draft/attachments/:name` — upload one draft attachment. */
  uploadDraftAttachment (token: string, projectId: number, xmlFormId: string, body: { name: string, blob: Blob, contentType: string }): Promise<void>
  /** `GET .../forms/:xmlFormId/draft/attachments` — the draft's expected attachments. */
  listDraftAttachments (token: string, projectId: number, xmlFormId: string): Promise<CentralAttachmentDescriptor[]>
}

/** Map a resolved non-OK response status to a `CentralError` kind. */
const kindForStatus = (status: number): CentralErrorKind => {
  if (status === 401 || status === 403) return 'auth'
  if (status === 409) return 'conflict'
  if (status === 404) return 'not-found'
  return 'http'
}

/** A `fetch` rejection (TypeError) is a CORS block or an offline device, and
 * the two are indistinguishable at the network layer. Use `navigator.onLine`
 * as a heuristic: an explicit `false` means offline; anything else (online or
 * unknown) is treated as a CORS/reachability problem. */
const kindForRejection = (): 'network' | 'cors' =>
  globalThis.navigator?.onLine === false ? 'network' : 'cors'

/** Read a response body as JSON, returning `undefined` on any parse failure so
 * coercers apply their safe defaults rather than a raw error propagating. */
const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

/** Pull Central's structured `code`/`details`/`message` off an error body. */
const parseErrorBody = async (
  response: Response
): Promise<{ code?: string, details?: unknown, message?: string }> => {
  const raw = await readJson(response)
  if (!isRecord(raw)) return {}
  return {
    code: typeof raw.code === 'string' ? raw.code : undefined,
    details: raw.details,
    message: typeof raw.message === 'string' ? raw.message : undefined,
  }
}

interface RequestOptions {
  method?: string
  token?: string
  /** Content-Type for a request that carries a body. */
  contentType?: string
  body?: BodyInit
}

export const createCentralClient = ({
  baseUrl,
  fetchImpl = globalThis.fetch.bind(globalThis),
}: CreateCentralClientOptions): CentralClient => {
  // Opaque join: trim trailing slashes so appending an absolute `/v1/...` path
  // never double-slashes, while any path prefix survives.
  const base = baseUrl.replace(/\/+$/, '')

  const send = async (path: string, opts: RequestOptions = {}): Promise<Response> => {
    const headers: Record<string, string> = {}
    if (opts.token !== undefined) headers.Authorization = `Bearer ${opts.token}`
    if (opts.contentType !== undefined) headers['Content-Type'] = opts.contentType

    let response: Response
    try {
      response = await fetchImpl(base + path, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body,
      })
    } catch {
      const kind = kindForRejection()
      throw new CentralError(
        kind === 'network'
          ? 'Network request failed — the device appears to be offline.'
          : 'Network request failed — the server may be unreachable or blocking cross-origin requests.',
        { kind }
      )
    }

    if (!response.ok) {
      const { code, details, message } = await parseErrorBody(response)
      throw new CentralError(
        message ?? `Central request failed with HTTP ${response.status}.`,
        { kind: kindForStatus(response.status), status: response.status, code, details }
      )
    }
    return response
  }

  const forms = (projectId: number): string => `/v1/projects/${projectId}/forms`

  return {
    createSession: async (email, password) => {
      const response = await send('/v1/sessions', {
        method: 'POST',
        contentType: 'application/json',
        body: JSON.stringify({ email, password }),
      })
      return coerceSession(await readJson(response))
    },

    deleteSession: async (token) => {
      await send(`/v1/sessions/${encodeURIComponent(token)}`, { method: 'DELETE', token })
    },

    listProjects: async (token) => {
      const response = await send('/v1/projects', { token })
      return coerceProjectList(await readJson(response))
    },

    listForms: async (token, projectId) => {
      const response = await send(forms(projectId), { token })
      return coerceFormSummaryList(await readJson(response))
    },

    getPublishedFormXml: async (token, projectId, xmlFormId) => {
      const response = await send(`${forms(projectId)}/${encodeURIComponent(xmlFormId)}.xml`, { token })
      return response.text()
    },

    getDraftFormXml: async (token, projectId, xmlFormId) => {
      const response = await send(`${forms(projectId)}/${encodeURIComponent(xmlFormId)}/draft.xml`, { token })
      return response.text()
    },

    listPublishedAttachments: async (token, projectId, xmlFormId) => {
      const response = await send(`${forms(projectId)}/${encodeURIComponent(xmlFormId)}/attachments`, { token })
      return coerceAttachmentDescriptorList(await readJson(response))
    },

    downloadPublishedAttachment: async (token, projectId, xmlFormId, name) => {
      const response = await send(
        `${forms(projectId)}/${encodeURIComponent(xmlFormId)}/attachments/${encodeURIComponent(name)}`,
        { token }
      )
      return response.blob()
    },

    createForm: async (token, projectId, xml) => {
      const response = await send(`${forms(projectId)}?ignoreWarnings=true&publish=false`, {
        method: 'POST',
        token,
        contentType: 'application/xml',
        body: xml,
      })
      return coercePublishOutcome(await readJson(response))
    },

    updateDraft: async (token, projectId, xmlFormId, xml) => {
      const response = await send(`${forms(projectId)}/${encodeURIComponent(xmlFormId)}/draft?ignoreWarnings=true`, {
        method: 'POST',
        token,
        contentType: 'application/xml',
        body: xml,
      })
      return coercePublishOutcome(await readJson(response))
    },

    uploadDraftAttachment: async (token, projectId, xmlFormId, { name, blob, contentType }) => {
      await send(
        `${forms(projectId)}/${encodeURIComponent(xmlFormId)}/draft/attachments/${encodeURIComponent(name)}`,
        { method: 'POST', token, contentType, body: blob }
      )
    },

    listDraftAttachments: async (token, projectId, xmlFormId) => {
      const response = await send(`${forms(projectId)}/${encodeURIComponent(xmlFormId)}/draft/attachments`, { token })
      return coerceAttachmentDescriptorList(await readJson(response))
    },
  }
}
