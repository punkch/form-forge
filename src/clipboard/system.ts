/**
 * System-clipboard glue — the other half of the hybrid clipboard transport
 * (see buffer.ts and docs/specs/2026-07-23-1242-canvas-multiselect-clipboard/
 * plan.md, Task 4). Best-effort only: the localStorage buffer is the source
 * of truth for same-app paste, so a permission denial or an unfocused
 * document here never blocks anything, it just means an external app can't
 * see the copy (or a native ClipboardEvent falls back to the buffer).
 */

/**
 * Fire-and-forget write of the serialized payload to the OS clipboard via the
 * async Clipboard API, so pasting into another application (or another
 * Form Forge tab via native Ctrl+V, before the buffer is even consulted)
 * carries the payload as plain text. No-ops when the API is unavailable
 * (unsupported browser, insecure context) or when the write is rejected
 * (permission denied, document not focused) — never throws, never awaited by
 * the caller.
 */
export const writeSystemClipboard = (json: string): void => {
  if (typeof navigator === 'undefined' || navigator.clipboard?.writeText === undefined) return
  navigator.clipboard.writeText(json).catch(() => {
    // Best-effort only — see module doc. The localStorage buffer already has
    // the payload, so same-app paste is unaffected.
  })
}

/**
 * Populate a native `copy`/`cut` ClipboardEvent with the payload under both
 * `application/json` (round-trips losslessly back through
 * `payloadFromClipboardEvent`/`tryParseClipboardText`) and `text/plain` (so
 * pasting into an unrelated app, or a browser that strips custom MIME types,
 * still yields readable JSON rather than nothing).
 */
export const applyToClipboardEvent = (e: ClipboardEvent, json: string): void => {
  e.clipboardData?.setData('application/json', json)
  e.clipboardData?.setData('text/plain', json)
}

/**
 * Extract the candidate clipboard text from a native `paste` ClipboardEvent:
 * prefer `application/json` (written by `applyToClipboardEvent` above), and
 * fall back to `text/plain` (a payload copied as text, or pasted from
 * another tab/app). Returns the raw string for the caller to sniff/parse
 * (`tryParseClipboardText` in src/core/clipboard/payload.ts) — this module
 * doesn't know the payload shape. Null when neither carries anything.
 */
export const payloadFromClipboardEvent = (e: ClipboardEvent): string | null => {
  const json = e.clipboardData?.getData('application/json')
  if (json !== undefined && json !== '') return json
  const text = e.clipboardData?.getData('text/plain')
  if (text !== undefined && text !== '') return text
  return null
}
