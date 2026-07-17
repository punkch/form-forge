/**
 * Assemble a FormDocument (plus its attachment blobs) from a published form on
 * an ODK Central server — the pure counterpart of the ImportDialog "From
 * Central" source.
 *
 * Pure core: no Vue/Pinia/Dexie/vue-i18n imports. The (already token-bound)
 * `CentralClient` is injected, so unit tests drive this with a fake client and
 * never touch the network; the store owns token lifetime and passes both the
 * client and the token in.
 *
 * THE load-bearing detail: `parseXForm` sets `document.attachments = []` and
 * never populates it (parser.ts). If we returned the parsed document as-is, its
 * attachment refs would be empty, so (a) `validate/refs.ts` would flag every
 * referenced file as "referenced but not uploaded", and (b) the zip export
 * would omit the blobs. We therefore rebuild `document.attachments` from
 * Central's attachment list (via the shared `roleFor` classifier) before
 * returning, matching the shape the archive-import landing path expects.
 *
 * Central marks an expected-but-not-yet-uploaded attachment as `exists:false`;
 * those are skipped (nothing to download). `createFormWithArchiveAttachments`
 * uses `dropUnmatched:true`, so a skipped file also drops from
 * `document.attachments` on landing — the same "missing = not uploaded"
 * behaviour as a file import.
 */
import { attachmentRefsFor } from '../model/attachment-role'
import { normalizeDefaultContent } from '../model/translations'
import type { FormDocument } from '../model/types'
import type { Issue } from '../validate/issues'
import { DEFAULT_MEDIATYPE, type ArchiveAttachment } from '../workspace/archive'
import { parseXForm } from '../xform/parser'

import type { CentralClient } from './client'

export interface CentralImportInput {
  /** A client already bound to the target server (the store injects it). */
  client: CentralClient
  /** The session bearer token (kept private by the store; passed in here). */
  token: string
  /** ODK Central numeric project id. */
  projectId: number
  /** The Central xmlFormId (form definition id) to pull. */
  xmlFormId: string
}

export interface CentralImportResult {
  /** The parsed document, with `attachments` rebuilt from Central's list. */
  document: FormDocument
  /** Parser issues (same `Issue[]` the file-import report renders). */
  issues: Issue[]
  /** Downloaded blobs in the archive-import currency (`{filename, mediatype, blob}`). */
  attachments: ArchiveAttachment[]
}

/**
 * Pull a published form and its attachments from ODK Central and assemble the
 * `{document, issues, attachments}` the import-landing path consumes. Transport
 * failures propagate as the injected client's `CentralError` (the UI maps
 * `kind` → `central.errors.*`); this function never localizes.
 */
export const importFormFromCentral = async (
  input: CentralImportInput
): Promise<CentralImportResult> => {
  const { client, token, projectId, xmlFormId } = input

  const xml = await client.getPublishedFormXml(token, projectId, xmlFormId)
  const { document, issues } = parseXForm(xml)
  // Import boundary: merge mixed default+named-language text into the primary
  // language (no-op on clean docs, conflict cells kept).
  normalizeDefaultContent(document)

  const descriptors = await client.listPublishedAttachments(token, projectId, xmlFormId)
  // exists:false → expected-but-not-uploaded on Central; nothing to fetch. The
  // remaining downloads are independent, so we fire them concurrently and rebuild
  // the ordered arrays from the resolved results (map preserves descriptor order,
  // so the output stays deterministic regardless of completion order).
  const present = descriptors.filter((descriptor) => descriptor.exists)
  const downloaded = await Promise.all(
    present.map(async (descriptor) => {
      const blob = await client.downloadPublishedAttachment(token, projectId, xmlFormId, descriptor.name)
      // Prefer the download's Content-Type (surfaced as blob.type), defaulting to
      // application/octet-stream when the server sent none.
      const mediatype = blob.type !== '' ? blob.type : DEFAULT_MEDIATYPE
      return { filename: descriptor.name, mediatype, blob }
    })
  )

  const attachments: ArchiveAttachment[] = downloaded.map(({ filename, mediatype, blob }) => ({
    filename,
    mediatype,
    blob,
  }))

  // The load-bearing line: without this the parsed document reports zero
  // attachments even though we downloaded blobs for it.
  document.attachments = attachmentRefsFor(downloaded)

  return { document, issues, attachments }
}
