/**
 * Embed-mode postMessage bridge (protocol v1): listens for host requests,
 * dispatches them against the persistence layer and router, and emits
 * ready / state-changed / error events. Wire shapes live in ./protocol.ts;
 * the full contract is documented in
 * docs/specs/2026-07-09-2235-embed-postmessage-api/.
 *
 * Security model:
 * - only messages whose `event.source` is the parent window are handled;
 * - when the URL pinned a host origin (?origin=…), any other `event.origin`
 *   is ignored silently;
 * - outbound messages target the pinned origin — or, once init has been
 *   received, the init message's actual origin. init is REFUSED when neither is
 *   known (no ?origin= param and an empty event.origin), so a form-bearing
 *   reply can never be posted to '*';
 * - ArrayBuffers ride the transfer list instead of being copied.
 */
import type { Pinia } from 'pinia'
import { watch } from 'vue'
import type { Router } from 'vue-router'

import { newDocument } from '@/core/model/factory'
import { migrateDoc } from '@/core/model/migrate'
import type { FormDocument } from '@/core/model/types'
import type { Issue } from '@/core/validate/issues'
import {
  buildWorkspaceArchive,
  readWorkspaceArchive,
  type ArchiveAttachment,
  type ArchiveFormInput,
} from '@/core/workspace/archive'
import { dexieBackend, setPersistenceBackend } from '@/persistence/backend'
import { createFormWithArchiveAttachments, deleteForm } from '@/persistence/forms-repo'
import { createMemoryBackend } from '@/persistence/memory-backend'
import { gatherArchiveForms } from '@/persistence/workspace-io'
import { useEmbedStore } from '@/stores/embed'
import { useFormStore } from '@/stores/form'

import {
  coerceEmbedConfig,
  isEnvelope,
  isHostRequestType,
  parseLoadFormPayload,
  parseSaveFormat,
  PROTOCOL_CHANNEL,
  PROTOCOL_VERSION,
  type BuilderMessage,
  type EmbedConfig,
  type EmbedErrorCode,
  type EmbedPersistence,
  type HostMessage,
  type SaveFormMeta,
  type WireAttachment,
  type WireIssue,
} from './protocol'

export const STATE_CHANGED_DEBOUNCE_MS = 300

const appVersion = (): string =>
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '1.0.0-dev'

const toWireIssues = (issues: Issue[]): WireIssue[] =>
  issues.map((issue) => ({ severity: issue.severity, code: issue.code, message: issue.message }))

/** Exact ArrayBuffer of a Uint8Array without copying when the view spans it. */
const exactBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
    ? bytes.buffer as ArrayBuffer
    : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

export interface EmbedBridgeOptions {
  router: Router
  pinia: Pinia
}

/** Start listening for host messages and post 'ready'. Returns a stopper. */
export const startEmbedBridge = ({ router, pinia }: EmbedBridgeOptions): (() => void) => {
  const embed = useEmbedStore(pinia)
  const form = useFormStore(pinia)

  // Until init: the URL-pinned origin, or '*' (the pre-init messages — ready,
  // not-initialized errors, and init's own refusal — never contain form data).
  // After a successful init: always a concrete host origin (init is refused
  // when none can be determined).
  let targetOrigin = embed.hostOrigin ?? '*'

  const envelope = { channel: PROTOCOL_CHANNEL, v: PROTOCOL_VERSION } as const

  const post = (message: BuilderMessage, transfer: Transferable[] = []): void => {
    window.parent.postMessage(message, targetOrigin, transfer)
  }

  const postError = (code: EmbedErrorCode, message: string, requestId?: string): void => {
    post({ ...envelope, type: 'error', requestId, code, message })
  }

  // --- state-changed event (debounced) ------------------------------------

  let stateTimer: ReturnType<typeof setTimeout> | null = null
  const stopStateWatch = watch(
    () => [form.saveState, form.errorCount] as const,
    () => {
      if (!embed.initialized) return
      if (stateTimer !== null) clearTimeout(stateTimer)
      stateTimer = setTimeout(() => {
        stateTimer = null
        post({
          ...envelope,
          type: 'state-changed',
          dirty: form.saveState !== 'saved',
          errorCount: form.errorCount,
        })
      }, STATE_CHANGED_DEBOUNCE_MS)
    }
  )

  // --- request handlers ----------------------------------------------------

  const applyPersistence = (before: EmbedPersistence, after: EmbedPersistence): void => {
    if (before === after) return
    setPersistenceBackend(after === 'local' ? dexieBackend : createMemoryBackend())
  }

  type ApplyConfigResult = { ok: true } | { ok: false, code: EmbedErrorCode, message: string }

  /**
   * Shared init/set-config body: coerce the host config, apply it, and swap the
   * persistence backend when it changed. Changing persistence while a form is
   * loaded is refused — the loaded record lives in the current backend and a
   * later save would target the wrong one — but the other config keys still
   * apply and the caller reports the rejection as bad-request.
   */
  const applyIncomingConfig = (raw: unknown): ApplyConfigResult => {
    const before = embed.config.persistence ?? 'memory'
    const config = coerceEmbedConfig(raw)
    if (config.persistence !== undefined && config.persistence !== before && form.recordId !== null) {
      const rest: EmbedConfig = { ...config }
      delete rest.persistence
      embed.applyConfig(rest)
      return { ok: false, code: 'bad-request', message: 'Cannot change persistence while a form is loaded.' }
    }
    embed.applyConfig(config)
    applyPersistence(before, embed.config.persistence ?? 'memory')
    return { ok: true }
  }

  const handleInit = (message: HostMessage & { type: 'init' }, origin: string): void => {
    // From here on every post targets the host's real origin, even when no
    // origin URL param pinned inbound filtering.
    if (origin !== '') targetOrigin = origin
    if (targetOrigin === '*') {
      // No pinned origin and an empty event.origin (sandboxed frame / file://):
      // there is no concrete origin to send form-bearing replies to, so refuse
      // init rather than ever post form data to '*'. A later init carrying a
      // real origin can still succeed.
      postError('bad-request', 'The builder could not determine the host origin; reload it with an ?origin= parameter.', message.requestId)
      return
    }
    const result = applyIncomingConfig(message.config)
    embed.initialized = true
    if (!result.ok) {
      postError(result.code, result.message, message.requestId)
      return
    }
    post({ ...envelope, type: 'init-result', requestId: message.requestId, ok: true, protocolVersion: PROTOCOL_VERSION })
  }

  const handleSetConfig = (message: HostMessage & { type: 'set-config' }): void => {
    const result = applyIncomingConfig(message.config)
    if (!result.ok) {
      postError(result.code, result.message, message.requestId)
      return
    }
    post({ ...envelope, type: 'set-config-result', requestId: message.requestId, ok: true })
  }

  // The record the bridge itself created for the currently open form. Each
  // load deletes the one the previous load left behind, so a load → save →
  // load-back cycle never piles up orphan records — harmless in memory mode,
  // essential in 'local' mode where they would linger in the user's library.
  let bridgeRecordId: string | null = null

  /**
   * Store a document + attachment blobs as a fresh record (ids minted, refs
   * remapped exactly like archive import) and open the editor on it. Awaits the
   * form store's own load before it resolves, so an immediate save-form after
   * the load-form-result always sees the loaded record (router.push resolves on
   * mount, but the editor view's own load is fire-and-forget).
   */
  const openForm = async (doc: FormDocument, attachments: ArchiveAttachment[]): Promise<void> => {
    const previous = bridgeRecordId
    const record = await createFormWithArchiveAttachments(doc, attachments)
    bridgeRecordId = record.id
    await form.load(record.id)
    if (previous !== null && previous !== record.id) await deleteForm(previous)
    await router.push({ name: 'editor', params: { formId: record.id } })
  }

  const handleLoadForm = async (message: HostMessage & { type: 'load-form' }): Promise<void> => {
    const loadResult = (ok: boolean, issues: Issue[]): BuilderMessage =>
      ({ ...envelope, type: 'load-form-result', requestId: message.requestId, ok, issues: toWireIssues(issues) })
    const parsed = parseLoadFormPayload(message.payload)
    if (!parsed.ok) {
      postError(parsed.error, 'The load-form payload is malformed or its format is not supported.', message.requestId)
      return
    }
    const payload = parsed.payload
    try {
      if (payload.format === 'new') {
        await openForm(newDocument(payload.title ?? 'Untitled form'), [])
        post(loadResult(true, []))
        return
      }
      if (payload.format === 'archive') {
        const { forms, issues } = await readWorkspaceArchive(payload.data)
        const first = forms[0]
        if (first === undefined) {
          post(loadResult(false, issues))
          return
        }
        await openForm(first.doc, first.attachments)
        post(loadResult(true, issues))
        return
      }
      const { doc, issues } = migrateDoc(payload.doc)
      if (doc === null) {
        post(loadResult(false, issues))
        return
      }
      const attachments: ArchiveAttachment[] = payload.attachments.map((att) => ({
        filename: att.filename,
        mediatype: att.mediatype,
        blob: new Blob([att.data], { type: att.mediatype }),
      }))
      await openForm(doc, attachments)
      post(loadResult(true, issues))
    } catch (err) {
      postError('load-failed', err instanceof Error ? err.message : String(err), message.requestId)
    }
  }

  const savedMeta = (gathered: ArchiveFormInput): SaveFormMeta => ({
    formId: gathered.meta.formId,
    title: gathered.meta.title,
    version: gathered.meta.version,
    errorCount: form.errorCount,
    warningCount: form.warningCount,
  })

  const handleSaveForm = async (message: HostMessage & { type: 'save-form' }): Promise<void> => {
    const format = parseSaveFormat(message.options)
    if (!format.ok) {
      postError(format.error, 'The save-form options are malformed or the format is not supported.', message.requestId)
      return
    }
    if (form.recordId === null) {
      postError('no-form-loaded', 'No form is loaded — send load-form first.', message.requestId)
      return
    }
    try {
      await form.flushSave()
      const [gathered] = await gatherArchiveForms([form.recordId])
      if (gathered === undefined) {
        postError('no-form-loaded', 'The loaded form no longer exists in storage.', message.requestId)
        return
      }
      const meta = savedMeta(gathered)
      if (format.format === 'archive') {
        const bytes = await buildWorkspaceArchive([gathered], appVersion(), new Date().toISOString())
        const data = exactBuffer(bytes)
        post({
          ...envelope,
          type: 'save-form-result',
          requestId: message.requestId,
          ok: true,
          payload: { format: 'archive', data },
          meta,
        }, [data])
        return
      }
      const attachments: WireAttachment[] = await Promise.all(
        gathered.attachments.map(async (att) => ({
          filename: att.filename,
          mediatype: att.mediatype,
          data: await att.blob.arrayBuffer(),
        }))
      )
      post({
        ...envelope,
        type: 'save-form-result',
        requestId: message.requestId,
        ok: true,
        payload: { format: 'object', doc: gathered.doc, attachments },
        meta,
      }, attachments.map((a) => a.data))
    } catch (err) {
      // No dedicated save error code in v1 — 'load-failed' doubles as the
      // generic "the form operation failed unexpectedly" code.
      postError('load-failed', err instanceof Error ? err.message : String(err), message.requestId)
    }
  }

  // --- transport -------------------------------------------------------------

  const onMessage = (event: MessageEvent): void => {
    // Only the parent window may drive the builder; with a pinned origin any
    // other sender origin is dropped without a reply (no probing feedback).
    if (event.source !== window.parent) return
    if (embed.hostOrigin !== null && event.origin !== embed.hostOrigin) return
    const data: unknown = event.data
    if (!isEnvelope(data)) return
    // Our own outbound types (and unknown future ones) are not requests.
    if (!isHostRequestType(data.type)) return
    if (typeof data.requestId !== 'string' || data.requestId === '') {
      postError('bad-request', 'Every request needs a string requestId.')
      return
    }
    const message = data as HostMessage
    if (message.type === 'init') {
      handleInit(message, event.origin)
      return
    }
    if (!embed.initialized) {
      postError('not-initialized', 'Send init before any other request.', message.requestId)
      return
    }
    switch (message.type) {
      case 'load-form':
        void handleLoadForm(message)
        break
      case 'save-form':
        void handleSaveForm(message)
        break
      case 'set-config':
        handleSetConfig(message)
        break
    }
  }

  window.addEventListener('message', onMessage)
  post({ ...envelope, type: 'ready', appVersion: appVersion() })

  return () => {
    window.removeEventListener('message', onMessage)
    stopStateWatch()
    if (stateTimer !== null) clearTimeout(stateTimer)
  }
}
