/**
 * Embed postMessage protocol v1 — pure wire types and guards, no Vue/Pinia/
 * DOM imports. Every message travels in the envelope
 * `{ channel: 'odk-builder', v: 1, type, requestId? }`; anything without the
 * channel is not ours and is ignored. The bridge (./bridge.ts) owns transport
 * and security; this module owns shapes.
 *
 * Full contract: docs/specs/2026-07-09-2235-embed-postmessage-api/plan.md.
 */
import { isRecord } from '@/core/util/guards'

export const PROTOCOL_CHANNEL = 'odk-builder'
export const PROTOCOL_VERSION = 1

export interface EmbedExportsConfig {
  xform?: boolean
  xlsform?: boolean
  zip?: boolean
}

export type EmbedPersistence = 'memory' | 'local'

export interface EmbedConfig {
  /** Export actions visibility; a key is hidden only when explicitly false. */
  exports?: EmbedExportsConfig
  /** Where the builder stores the working form; default 'memory'. */
  persistence?: EmbedPersistence
  /** BCP-47 UI language tag, e.g. 'en'. */
  locale?: string
}

interface EnvelopeBase {
  channel: typeof PROTOCOL_CHANNEL
  v: typeof PROTOCOL_VERSION
}

/** Serializable projection of a validation Issue. */
export interface WireIssue {
  severity: string
  code: string
  message: string
}

/** One attachment on the wire; `data` rides the postMessage transfer list. */
export interface WireAttachment {
  filename: string
  mediatype: string
  data: ArrayBuffer
}

export type LoadFormPayload =
  | { format: 'archive', data: ArrayBuffer }
  | { format: 'object', doc: unknown, attachments: WireAttachment[] }
  | { format: 'new', title?: string }

export type SaveFormat = 'archive' | 'object'

export type SavedFormPayload =
  | { format: 'archive', data: ArrayBuffer }
  | { format: 'object', doc: unknown, attachments: WireAttachment[] }

export interface SaveFormMeta {
  formId: string
  title: string
  version: string
  errorCount: number
  warningCount: number
}

// --- Host → builder requests --------------------------------------------

export interface InitMessage extends EnvelopeBase {
  type: 'init'
  requestId: string
  config?: unknown
}

export interface LoadFormMessage extends EnvelopeBase {
  type: 'load-form'
  requestId: string
  payload?: unknown
}

export interface SaveFormMessage extends EnvelopeBase {
  type: 'save-form'
  requestId: string
  options?: { format?: unknown }
}

export interface SetConfigMessage extends EnvelopeBase {
  type: 'set-config'
  requestId: string
  config?: unknown
}

export type HostMessage = InitMessage | LoadFormMessage | SaveFormMessage | SetConfigMessage

// --- Builder → host messages ----------------------------------------------

export interface ReadyMessage extends EnvelopeBase {
  type: 'ready'
  appVersion: string
}

export interface InitResultMessage extends EnvelopeBase {
  type: 'init-result'
  requestId: string
  ok: true
  protocolVersion: typeof PROTOCOL_VERSION
}

export interface LoadFormResultMessage extends EnvelopeBase {
  type: 'load-form-result'
  requestId: string
  ok: boolean
  issues: WireIssue[]
}

export interface SaveFormResultMessage extends EnvelopeBase {
  type: 'save-form-result'
  requestId: string
  ok: true
  payload: SavedFormPayload
  meta: SaveFormMeta
}

export interface SetConfigResultMessage extends EnvelopeBase {
  type: 'set-config-result'
  requestId: string
  ok: true
}

export interface StateChangedMessage extends EnvelopeBase {
  type: 'state-changed'
  dirty: boolean
  errorCount: number
}

export type EmbedErrorCode =
  | 'not-initialized'
  | 'bad-request'
  | 'no-form-loaded'
  | 'load-failed'
  | 'unsupported-format'

export interface ErrorMessage extends EnvelopeBase {
  type: 'error'
  requestId?: string
  code: EmbedErrorCode
  message: string
}

export type BuilderMessage =
  | ReadyMessage
  | InitResultMessage
  | LoadFormResultMessage
  | SaveFormResultMessage
  | SetConfigResultMessage
  | StateChangedMessage
  | ErrorMessage

// --- Guards ---------------------------------------------------------------

/** Addressed to this protocol: correct channel + version and a string type. */
export const isEnvelope = (data: unknown): data is EnvelopeBase & { type: string, requestId?: unknown } =>
  isRecord(data) &&
  data.channel === PROTOCOL_CHANNEL &&
  data.v === PROTOCOL_VERSION &&
  typeof data.type === 'string'

const HOST_REQUEST_TYPES = ['init', 'load-form', 'save-form', 'set-config'] as const satisfies readonly HostMessage['type'][]

export const isHostRequestType = (type: string): type is HostMessage['type'] =>
  (HOST_REQUEST_TYPES as readonly string[]).includes(type)

export const isWireAttachment = (value: unknown): value is WireAttachment =>
  isRecord(value) &&
  typeof value.filename === 'string' &&
  typeof value.mediatype === 'string' &&
  value.data instanceof ArrayBuffer

export type LoadFormPayloadResult =
  | { ok: true, payload: LoadFormPayload }
  | { ok: false, error: Extract<EmbedErrorCode, 'bad-request' | 'unsupported-format'> }

/** Validate an untrusted load-form payload; malformed shapes are
 * 'bad-request', a format we don't know is 'unsupported-format'. */
export const parseLoadFormPayload = (raw: unknown): LoadFormPayloadResult => {
  if (!isRecord(raw) || typeof raw.format !== 'string') return { ok: false, error: 'bad-request' }
  switch (raw.format) {
    case 'archive':
      return raw.data instanceof ArrayBuffer
        ? { ok: true, payload: { format: 'archive', data: raw.data } }
        : { ok: false, error: 'bad-request' }
    case 'object': {
      const attachments = raw.attachments
      if (!isRecord(raw.doc) || !Array.isArray(attachments) || !attachments.every(isWireAttachment)) {
        return { ok: false, error: 'bad-request' }
      }
      return { ok: true, payload: { format: 'object', doc: raw.doc, attachments } }
    }
    case 'new':
      return raw.title === undefined || typeof raw.title === 'string'
        ? { ok: true, payload: { format: 'new', title: raw.title } }
        : { ok: false, error: 'bad-request' }
    default:
      return { ok: false, error: 'unsupported-format' }
  }
}

export type SaveFormatResult =
  | { ok: true, format: SaveFormat }
  | { ok: false, error: Extract<EmbedErrorCode, 'bad-request' | 'unsupported-format'> }

/** Resolve save-form options to a format (default 'archive'). */
export const parseSaveFormat = (options: unknown): SaveFormatResult => {
  if (options === undefined) return { ok: true, format: 'archive' }
  if (!isRecord(options)) return { ok: false, error: 'bad-request' }
  const format = options.format ?? 'archive'
  if (format === 'archive' || format === 'object') return { ok: true, format }
  return { ok: false, error: typeof format === 'string' ? 'unsupported-format' : 'bad-request' }
}

/**
 * Keep only the config keys and value types the protocol defines. `exports`
 * carries ONLY the flags the host actually sent (missing flags stay absent, not
 * `undefined`), so the store can merge exports per key and a later set-config
 * never silently re-enables a flag an earlier call disabled.
 */
export const coerceEmbedConfig = (raw: unknown): EmbedConfig => {
  if (!isRecord(raw)) return {}
  const config: EmbedConfig = {}
  if (isRecord(raw.exports)) {
    const exports: EmbedExportsConfig = {}
    const rawExports = raw.exports
    for (const key of ['xform', 'xlsform', 'zip'] as const) {
      if (typeof rawExports[key] === 'boolean') exports[key] = rawExports[key]
    }
    config.exports = exports
  }
  if (raw.persistence === 'memory' || raw.persistence === 'local') config.persistence = raw.persistence
  if (typeof raw.locale === 'string' && raw.locale !== '') config.locale = raw.locale
  return config
}
