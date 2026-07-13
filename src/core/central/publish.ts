/**
 * The pure publish sequence: push a form's current draft to an ODK Central
 * project, then upload its attachments in order.
 *
 * Framework-free core (no Vue/Pinia/Dexie/vue-i18n imports): the caller injects
 * an already-authenticated client + token, the serialized XForm, and the
 * attachment blobs (resolved from the persistence repo). The sequence is:
 *
 *   create-or-update the draft  →  upload each attachment  →  structured result
 *
 * A transport/API failure surfaces as the client's `CentralError` (propagated
 * unchanged — e.g. a formId collision arrives as
 * `CentralError{ kind:'conflict', code:'409.3' }`, which the UI offers to
 * recover from by updating the existing form or by bumping the version and
 * retrying). Central's own warnings are passed through verbatim; core never
 * localizes.
 */
import { DEFAULT_MEDIATYPE, type ArchiveAttachment } from '../workspace/archive'
import { isRecord } from '../util/guards'

/** Whether this publish creates a brand-new Central form or updates an existing
 * one's draft. A create posts to `.../forms`; an update posts to the existing
 * form's `.../draft`. */
export type PublishMode = 'create' | 'update'

/** Progress ticks a caller can render (the "Uploading …" copy). The form phase
 * fires once before the definition upload; an attachment phase fires per file. */
export interface PublishProgress {
  phase: 'form' | 'attachment'
  /** Attachment filename (attachment phase only). */
  name?: string
  /** 1-based index of the attachment being uploaded (attachment phase only). */
  index?: number
  /** Total attachment count (attachment phase only). */
  total?: number
}

/**
 * The (optional) structured body Central returns from a create/update-draft
 * POST. The transport client parses it and surfaces any `warnings` here (Central
 * reports them under a `warnings` key when the form is accepted with
 * `?ignoreWarnings=true`); `publishForm` passes whatever is present straight
 * through, never inventing or localizing it.
 */
export interface PublishOutcome {
  warnings?: string[]
}

/**
 * The narrow slice of the Central client the publish sequence uses. Kept as its
 * own structural interface (rather than importing the full `CentralClient`) so
 * this module stays a leaf and is trivially faked in tests; the real
 * `CentralClient` satisfies it — its `Promise<PublishOutcome>` create/update
 * returns are assignable to `Promise<PublishOutcome | void>`.
 */
export interface PublishClient {
  createForm (token: string, projectId: number, xml: string): Promise<PublishOutcome | void>
  updateDraft (token: string, projectId: number, xmlFormId: string, xml: string): Promise<PublishOutcome | void>
  uploadDraftAttachment (
    token: string,
    projectId: number,
    xmlFormId: string,
    body: { name: string, blob: Blob, contentType: string }
  ): Promise<void>
}

export interface PublishInput {
  client: PublishClient
  token: string
  projectId: number
  /**
   * The Central xmlFormId to publish under. For a create this is the id carried
   * in `xml` (i.e. `doc.settings.formId`), resolved from the caller's own inputs
   * because the create call returns no body; for an update it is the existing
   * target's xmlFormId.
   */
  xmlFormId: string
  /** The serialized XForm definition. */
  xml: string
  attachments: ArchiveAttachment[]
  mode: PublishMode
  onProgress?: (progress: PublishProgress) => void
}

export interface CentralPublishResult {
  xmlFormId: string
  mode: PublishMode
  attachmentsUploaded: number
  /** Central's warnings, passed through verbatim (empty when none / unavailable). */
  warnings: string[]
}

/**
 * Coerce an untrusted create/update-draft response body into the structured
 * outcome: only a genuine array of strings survives as `warnings`, everything
 * else yields an empty outcome. Exported so the transport client can coerce the
 * raw JSON body at its boundary (mirroring the other `coerce*` helpers), while
 * `publishForm` re-applies it — the call is idempotent — to stay defensive
 * against any structural `PublishClient` (e.g. a test fake) it is handed.
 */
export const coercePublishOutcome = (raw: unknown): PublishOutcome => {
  if (isRecord(raw) && Array.isArray(raw.warnings)) {
    return { warnings: raw.warnings.filter((w): w is string => typeof w === 'string') }
  }
  return {}
}

/**
 * Run the publish sequence. Rejects with the client's `CentralError` on any
 * transport/API failure (the definition step's `409.3` conflict included) — the
 * caller decides whether to bump the version and retry.
 */
export const publishForm = async (input: PublishInput): Promise<CentralPublishResult> => {
  const { client, token, projectId, xmlFormId, xml, attachments, mode, onProgress } = input

  onProgress?.({ phase: 'form' })
  const outcome = coercePublishOutcome(mode === 'create'
    ? await client.createForm(token, projectId, xml)
    : await client.updateDraft(token, projectId, xmlFormId, xml))
  const warnings = outcome.warnings ?? []

  const total = attachments.length
  let uploaded = 0
  for (const attachment of attachments) {
    uploaded += 1
    onProgress?.({ phase: 'attachment', name: attachment.filename, index: uploaded, total })
    await client.uploadDraftAttachment(token, projectId, xmlFormId, {
      name: attachment.filename,
      blob: attachment.blob,
      contentType: attachment.mediatype || DEFAULT_MEDIATYPE,
    })
  }

  return { xmlFormId, mode, attachmentsUploaded: uploaded, warnings }
}
