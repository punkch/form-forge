/**
 * Persistence wiring for workspace archives: gathers FormRecords (with the
 * attachment blobs their documents actually reference) for export, and
 * imports parsed archive forms as brand-new records — import never
 * overwrites existing data.
 *
 * `gatherArchiveForms` stays forms-only, so the single-form / shareable export
 * path is credential-free by construction. The whole-workspace *backup* path
 * (`gatherWorkspaceBackup` → `importWorkspaceBackup`) additionally carries the
 * Central section (server config + publish targets always; the credential vault
 * + saved passwords only when the user opts in — the strip happens here in the
 * gather step, so a secret never reaches the pure builder otherwise) and the
 * user's locally saved templates (the "New form from template" gallery).
 */
import { newId } from '@/core/model/ids'
import { error, warning, type Issue } from '@/core/validate/issues'
import type {
  ArchiveAttachment,
  ArchiveCentralData,
  ArchiveCentralServer,
  ArchiveFormInput,
  ArchivePublishTarget,
  ArchiveTemplate,
  ArchiveVault,
  ParsedArchiveForm,
} from '@/core/workspace/archive'

import { getPersistenceBackend } from './backend'
import type { AttachmentRecord, CentralServerRecord, FormRecord, TemplateRecord } from './db'
import { createFormWithArchiveAttachments, listForms } from './forms-repo'
import { upsertTarget } from './publish-targets-repo'

/**
 * Read forms (all, or the given record ids) and their attachments for
 * archiving. Blobs are looked up strictly via doc.attachments[].id, so
 * orphaned attachment records never leak into an export.
 */
export const gatherArchiveForms = async (recordIds?: string[]): Promise<ArchiveFormInput[]> => {
  const backend = getPersistenceBackend()
  const records = recordIds === undefined
    ? await backend.listForms()
    : (await backend.bulkGetForms(recordIds)).filter((r): r is FormRecord => r !== undefined)

  // One bulk read of every referenced blob, then assemble per form. Blobs are
  // still matched strictly by doc.attachments[].id, so orphaned attachment
  // records never leak into an export and missing blobs are skipped.
  const refIds = records.flatMap((r) => r.doc.attachments.map((ref) => ref.id))
  const byId = new Map<string, AttachmentRecord>()
  for (const att of await backend.bulkGetAttachments(refIds)) {
    if (att !== undefined) byId.set(att.id, att)
  }

  return records.map((record) => ({
    recordId: record.id,
    meta: {
      title: record.title,
      formId: record.formId,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
    doc: record.doc,
    attachments: record.doc.attachments.flatMap((ref): ArchiveAttachment[] => {
      const att = byId.get(ref.id)
      return att === undefined ? [] : [{ filename: att.filename, mediatype: att.mediatype, blob: att.blob }]
    }),
  }))
}

/**
 * Gather a whole-workspace backup: every form + attachment (as
 * `gatherArchiveForms`) plus the Central section. Server config and publish
 * targets are always included; the credential vault + each server's
 * `encryptedPassword` are included only when `includeCredentials` is true.
 *
 * The stripping happens HERE, on the persistence side — when credentials are
 * not opted in, no secret byte ever reaches the pure archive builder, so the
 * default backup is credential-free by construction (not merely by a UI toggle).
 */
export const gatherWorkspaceBackup = async (
  { includeCredentials }: { includeCredentials: boolean }
): Promise<{ forms: ArchiveFormInput[], central: ArchiveCentralData, templates: ArchiveTemplate[] }> => {
  const forms = await gatherArchiveForms()
  const backend = getPersistenceBackend()

  const rawServers = await backend.listCentralServers()
  const servers: ArchiveCentralServer[] = rawServers.map((server) => {
    if (includeCredentials) return { ...server }
    const { encryptedPassword: _omit, ...rest } = server
    return rest
  })

  // Publish targets are non-secret publish history — always included. Union
  // across every backed-up form (targets are stored per form).
  const targets: ArchivePublishTarget[] = []
  for (const form of forms) targets.push(...await backend.listPublishTargets(form.recordId))

  let vault: ArchiveVault | undefined
  if (includeCredentials) {
    const meta = await backend.getVaultMeta()
    if (meta !== undefined) vault = { salt: meta.salt, keyCheck: meta.keyCheck }
  }

  // Locally saved templates are non-secret authored content — always included so
  // a restore rebuilds the user's whole "New form from template" gallery. Their
  // docs already carry no attachment refs (templates-repo strips them on save).
  const templates = await backend.listTemplates()

  return { forms, central: { servers, targets, vault }, templates }
}

export interface ImportArchiveResult {
  imported: number
  issues: Issue[]
  /** archive `recordId` → freshly minted workspace record id, for successful
   * imports only. Used to remap publish targets on a full-backup restore. */
  formIdMap: Map<string, string>
}

/**
 * Import parsed archive forms as new records. Each form goes through
 * createFormWithArchiveAttachments — one atomic backend write with freshly
 * minted record/attachment ids and filename-keyed attachment remap — so one
 * bad form never rolls back the rest. meta.createdAt is preserved while
 * updatedAt becomes the import time. A form_id already present in the library
 * only warns — the form is imported anyway.
 */
export const importArchiveForms = async (parsed: ParsedArchiveForm[]): Promise<ImportArchiveResult> => {
  const issues: Issue[] = []
  const formIdMap = new Map<string, string>()
  let imported = 0
  // Read existing form_ids once (updated as we go) instead of a full-table
  // scan for every imported form.
  const existingFormIds = new Set((await listForms()).map((r) => r.formId))
  for (const form of parsed) {
    try {
      const record = await createFormWithArchiveAttachments(form.doc, form.attachments, {
        createdAt: form.meta.createdAt,
      })
      imported++
      formIdMap.set(form.recordId, record.id)
      const collides = record.formId !== '' && existingFormIds.has(record.formId)
      if (record.formId !== '') existingFormIds.add(record.formId)
      if (collides) {
        issues.push(warning(
          'workspace.duplicate-form-id',
          `"${record.title}" was imported, but its form ID "${record.formId}" is already used by another form in the library.`
        ))
      }
    } catch (err) {
      issues.push(error(
        'workspace.import-failed',
        `"${form.meta.title}" could not be imported (${err instanceof Error ? err.message : String(err)}).`
      ))
    }
  }
  return { imported, issues, formIdMap }
}

export interface RestoreWorkspaceResult {
  /** Forms imported as new records. */
  imported: number
  /** Central servers newly inserted (deduped matches don't count). */
  serversImported: number
  /** Publish targets restored (remapped + upserted). */
  targetsImported: number
  /** Locally saved templates imported as new records. */
  templatesImported: number
  /** True when the imported vault + saved passwords were installed (the fresh
   * turnkey restore). False for a config-only or existing-vault restore. */
  credentialsRestored: boolean
  issues: Issue[]
}

/**
 * Import parsed archive templates as new records. Each gets a freshly minted id
 * (import never overwrites an existing template), with attachment refs stripped
 * defensively. Best-effort: one bad template never aborts the restore.
 */
const importArchiveTemplates = async (templates: ArchiveTemplate[]): Promise<number> => {
  const backend = getPersistenceBackend()
  let imported = 0
  for (const template of templates) {
    try {
      const record: TemplateRecord = {
        ...template,
        id: newId(),
        doc: { ...template.doc, attachments: [] },
      }
      await backend.addTemplate(record)
      imported++
    } catch {
      // Swallow: a single template that fails to insert must not fail the rest.
    }
  }
  return imported
}

/** Stable dedupe key for a Central server: same URL + email is "the same server". */
const serverDedupeKey = (baseUrl: string, email?: string): string => `${baseUrl}\u0000${email ?? ''}`

/**
 * Restore a whole-workspace backup: import forms as new records (like
 * `importArchiveForms`), restore any locally saved templates as new records,
 * then — when the archive carries a `central/` section — reconstruct servers,
 * credentials and publish targets with id remapping.
 *
 * Additive and best-effort; nothing existing is overwritten:
 * - **Servers** dedupe by `(baseUrl, email)`; a match reuses the existing row
 *   (never clobbering its config or saved password), otherwise a fresh row is
 *   inserted.
 * - **Credentials** follow a 3-way branch:
 *   - archive has none (default backup) → server config only, nothing to unlock;
 *   - archive has credentials AND this workspace has no vault → install the
 *     imported vault + keep each server's `encryptedPassword` (turnkey: the same
 *     passphrase unlocks);
 *   - archive has credentials BUT this workspace already has a (different) vault
 *     → keep the existing vault, drop the imported passwords (their ciphertext is
 *     useless under a different key) and warn.
 * - **Targets** remap `formRecordId` + `serverId`; any whose form or server did
 *   not import are dropped.
 */
export const importWorkspaceBackup = async (
  parsed: { forms: ParsedArchiveForm[], central?: ArchiveCentralData, templates?: ArchiveTemplate[] }
): Promise<RestoreWorkspaceResult> => {
  const { imported, issues, formIdMap } = await importArchiveForms(parsed.forms)

  // Templates are independent of Central — restore them before the central
  // early-return so a backup with templates but no server config still gets them.
  const templatesImported = await importArchiveTemplates(parsed.templates ?? [])

  const central = parsed.central
  if (central === undefined) {
    return { imported, serversImported: 0, targetsImported: 0, templatesImported, credentialsRestored: false, issues }
  }

  const backend = getPersistenceBackend()

  // --- Credential branch ----------------------------------------------------
  let credentialsRestored = false
  if (central.vault !== undefined) {
    const existingVault = await backend.getVaultMeta()
    if (existingVault === undefined) {
      try {
        await backend.putVaultMeta({ id: 'vault', salt: central.vault.salt, keyCheck: central.vault.keyCheck })
        credentialsRestored = true
      } catch (err) {
        // A failed vault write must not abort the (already-committed) form
        // import; surface it as an issue and continue config-only.
        issues.push(error(
          'workspace.credentials-not-restored',
          `The credential vault could not be restored (${err instanceof Error ? err.message : String(err)}); ` +
          'server config was restored but saved passwords were not.'
        ))
      }
    } else {
      issues.push(warning(
        'workspace.credentials-not-restored',
        'This workspace already has a credential vault, so the saved Central passwords in the backup ' +
        'were not restored. Re-enter them from Settings → Central servers.'
      ))
    }
  }
  // Only keep passwords when we actually installed the matching vault.
  const keepPasswords = credentialsRestored

  // --- Servers (dedupe by baseUrl+email; never overwrite an existing row) ----
  const existingServers = await backend.listCentralServers()
  const serverIdByKey = new Map(existingServers.map((s) => [serverDedupeKey(s.baseUrl, s.email), s.id]))
  const serverIdMap = new Map<string, string>()
  let serversImported = 0
  for (const server of central.servers) {
    const key = serverDedupeKey(server.baseUrl, server.email)
    const existingId = serverIdByKey.get(key)
    if (existingId !== undefined) {
      serverIdMap.set(server.id, existingId)
      // Turnkey restore into a workspace that already had this server registered
      // *without* a saved password: adopt the imported one. Safe because
      // `keepPasswords` is only true when the workspace had no vault, so no
      // existing row can already hold a (differently-keyed) password — and we
      // never touch a row that does. Config (name/URL/email) is left untouched.
      if (keepPasswords && server.encryptedPassword !== undefined) {
        const existing = await backend.getCentralServer(existingId)
        if (existing !== undefined && existing.encryptedPassword === undefined) {
          await backend.putCentralServer({ ...existing, encryptedPassword: server.encryptedPassword })
        }
      }
      continue
    }
    const record: CentralServerRecord = {
      id: newId(),
      name: server.name,
      baseUrl: server.baseUrl,
      ...(server.email === undefined ? {} : { email: server.email }),
      ...(keepPasswords && server.encryptedPassword !== undefined
        ? { encryptedPassword: server.encryptedPassword }
        : {}),
    }
    try {
      await backend.addCentralServer(record)
      serverIdByKey.set(key, record.id)
      serverIdMap.set(server.id, record.id)
      serversImported++
    } catch (err) {
      issues.push(error(
        'workspace.server-import-failed',
        `Central server "${server.name}" could not be imported (${err instanceof Error ? err.message : String(err)}).`
      ))
    }
  }

  // --- Targets (remap form + server ids; drop unmatched; natural-key upsert) --
  let targetsImported = 0
  for (const target of central.targets) {
    const newFormId = formIdMap.get(target.formRecordId)
    const newServerId = serverIdMap.get(target.serverId)
    if (newFormId === undefined || newServerId === undefined) continue
    try {
      await upsertTarget({
        formRecordId: newFormId,
        serverId: newServerId,
        projectId: target.projectId,
        xmlFormId: target.xmlFormId,
        lastPublishedVersion: target.lastPublishedVersion,
        lastPublishedAt: target.lastPublishedAt,
        ...(target.lastPublishedContentHash === undefined
          ? {}
          : { lastPublishedContentHash: target.lastPublishedContentHash }),
      })
      targetsImported++
    } catch {
      // Best-effort: a single bad target never fails the whole restore.
    }
  }

  return { imported, serversImported, targetsImported, templatesImported, credentialsRestored, issues }
}
