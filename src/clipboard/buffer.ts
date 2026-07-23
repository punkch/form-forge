/**
 * Clipboard buffer — the transport layer behind the hybrid clipboard (see
 * docs/specs/2026-07-23-1242-canvas-multiselect-clipboard/plan.md, Task 4).
 * App-level, NOT src/core/: it touches localStorage and `window`, the same
 * pure-vs-apply split as src/theme/ (constants pure, this module applies).
 *
 * Holds the most recent cross-form/cross-tab clipboard payload two ways:
 * an in-memory slot (always, this tab only, no size limit) and a
 * localStorage mirror (best-effort, size-capped, gives other tabs and a
 * future session something to read). `readClipboardBuffer` reconciles the two
 * by `copiedAt`, so whichever tab copied most recently wins regardless of
 * which slot answers.
 *
 * Generic over any payload shape that carries `copiedAt` — this module never
 * needs to know about NodesPayload's fields, only that it can compare
 * timestamps and round-trip the value through JSON. Callers (the form store /
 * useSelectionActions) supply the concrete src/core/clipboard payload type.
 */

import { MAX_BUFFER_CHARS } from '@/core/clipboard/payload'

/** The minimal shape this transport cares about: a JSON-serializable value
 * timestamped with the moment it was copied, used to arbitrate memory vs
 * localStorage and cross-tab writes. */
export interface ClipboardBufferPayload {
  copiedAt: number
}

const STORAGE_KEY = 'formforge.clipboard.v1'

/** This tab's copy of the last clipboard payload — always kept in sync with
 * the last `writeClipboardBuffer` call, independent of whether the
 * localStorage mirror succeeded or was skipped for size. */
let memory: ClipboardBufferPayload | null = null

/** Subscribers registered via `onClipboardBufferChange`, notified on every
 * local write (synchronously) and on cross-tab `storage` events. */
const listeners = new Set<() => void>()

const notify = (): void => {
  for (const cb of listeners) cb()
}

/** Best-effort read of the localStorage mirror. Returns null on a missing
 * key, corrupt JSON, or a value that doesn't look like a clipboard payload
 * (no numeric `copiedAt`) — including when localStorage itself is
 * unavailable (private browsing, partitioned embed iframe). */
const readLocalStorage = <T extends ClipboardBufferPayload>(): T | null => {
  try {
    if (typeof localStorage === 'undefined') return null
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    if (typeof (parsed as { copiedAt?: unknown }).copiedAt !== 'number') return null
    return parsed as T
  } catch {
    // Corrupt JSON, or storage access itself throws (SecurityError in a
    // partitioned/sandboxed context) — treat as "nothing there".
    return null
  }
}

/**
 * Store a clipboard payload: always in memory, and mirrored to localStorage
 * when it fits under MAX_BUFFER_CHARS serialized (oversize payloads stay
 * memory-only — still pasteable in this tab, just not cross-tab/cross-
 * session). All storage access is try/catch-guarded so a full quota, a
 * SecurityError from a partitioned embed iframe, or storage being disabled
 * entirely degrades silently to memory-only rather than throwing.
 */
export const writeClipboardBuffer = <T extends ClipboardBufferPayload>(payload: T): void => {
  memory = payload
  try {
    if (typeof localStorage !== 'undefined') {
      const serialized = JSON.stringify(payload)
      if (serialized.length <= MAX_BUFFER_CHARS) {
        localStorage.setItem(STORAGE_KEY, serialized)
      }
      // else: over the cap — leave any stale localStorage entry alone and
      // stay memory-only for this payload; readClipboardBuffer's copiedAt
      // arbitration still prefers this (newer) in-memory value.
    }
  } catch {
    // Quota exceeded, SecurityError, or storage unavailable — the in-memory
    // slot above already holds the payload, so same-tab paste still works.
  }
  notify()
}

/**
 * Read the current clipboard payload, reconciling the in-memory slot against
 * the localStorage mirror by `copiedAt` — whichever is newer wins, so a copy
 * made in another tab after this tab last wrote is picked up correctly.
 * Returns null when neither slot holds anything usable.
 */
export const readClipboardBuffer = <T extends ClipboardBufferPayload>(): T | null => {
  const stored = readLocalStorage<T>()
  if (memory === null) return stored
  if (stored === null) return memory as T
  return stored.copiedAt > memory.copiedAt ? stored : (memory as T)
}

/** Whether there is anything to paste right now (memory or localStorage). */
export const hasClipboardBuffer = (): boolean => readClipboardBuffer() !== null

/**
 * Subscribe to clipboard buffer changes: fires synchronously on every local
 * `writeClipboardBuffer` call in this tab, and on a cross-tab `storage` event
 * for this module's key (or a full `localStorage.clear()`, which the Storage
 * API reports with `key: null`) — the signal a paste-button's disabled state
 * needs to stay reactive across tabs. Returns an unsubscribe function that
 * removes both the local listener and the `storage` listener.
 */
export const onClipboardBufferChange = (cb: () => void): (() => void) => {
  listeners.add(cb)
  const onStorage = (e: StorageEvent): void => {
    if (e.key === STORAGE_KEY || e.key === null) cb()
  }
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage)
  }
}

/** Test hook: clear the in-memory slot and any dangling subscribers (module-
 * level state otherwise persists across tests in the same file). Does not
 * touch localStorage — callers clear that themselves. */
export const resetClipboardBufferForTests = (): void => {
  memory = null
  listeners.clear()
}
