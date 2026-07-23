// @vitest-environment happy-dom
// happy-dom (not the unit project's node env) so the buffer has localStorage
// to persist into and a window to dispatch/listen for 'storage' events on.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  hasClipboardBuffer,
  onClipboardBufferChange,
  readClipboardBuffer,
  resetClipboardBufferForTests,
  writeClipboardBuffer,
  type ClipboardBufferPayload,
} from './buffer'

const STORAGE_KEY = 'formforge.clipboard.v1'

interface TestPayload extends ClipboardBufferPayload {
  kind: 'test-payload'
  value: string
}

const payload = (value: string, copiedAt = Date.now()): TestPayload => ({
  kind: 'test-payload',
  value,
  copiedAt,
})

describe('clipboard buffer', () => {
  beforeEach(() => {
    localStorage.clear()
    resetClipboardBufferForTests()
  })

  afterEach(() => {
    localStorage.clear()
    resetClipboardBufferForTests()
  })

  it('round-trips a payload through write and read', () => {
    const p = payload('hello')
    writeClipboardBuffer(p)

    expect(readClipboardBuffer<TestPayload>()).toEqual(p)
    expect(hasClipboardBuffer()).toBe(true)

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string)).toEqual(p)
  })

  it('returns null and reports empty when nothing has been copied', () => {
    expect(readClipboardBuffer()).toBeNull()
    expect(hasClipboardBuffer()).toBe(false)
  })

  it('stays memory-only when the serialized payload exceeds the size cap', () => {
    // Well over MAX_BUFFER_CHARS (1_500_000, buffer.ts) once JSON-encoded.
    const big = payload('x'.repeat(2_000_000))
    writeClipboardBuffer(big)

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(readClipboardBuffer<TestPayload>()).toEqual(big)
    expect(hasClipboardBuffer()).toBe(true)
  })

  it('ignores corrupt JSON in localStorage, falling back to memory or null', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(readClipboardBuffer()).toBeNull()

    const p = payload('memory-value')
    writeClipboardBuffer(p)
    // A second tab writes garbage after this tab's legitimate write.
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(readClipboardBuffer<TestPayload>()).toEqual(p)
  })

  it('ignores a localStorage value without a numeric copiedAt', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ kind: 'test-payload', value: 'no-timestamp' }))
    expect(readClipboardBuffer()).toBeNull()
  })

  it('picks whichever of memory vs localStorage has the newest copiedAt', () => {
    const older = payload('older', 1000)
    const newer = payload('newer', 2000)

    // localStorage newer than memory — another tab copied after this tab's
    // last write.
    writeClipboardBuffer(older)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newer))
    expect(readClipboardBuffer<TestPayload>()).toEqual(newer)

    // memory newer than localStorage — e.g. an oversize payload that stayed
    // memory-only while a stale cross-tab entry lingers.
    resetClipboardBufferForTests()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(older))
    writeClipboardBuffer(newer)
    expect(readClipboardBuffer<TestPayload>()).toEqual(newer)
  })

  it('notifies subscribers on a local write and on a cross-tab storage event', () => {
    const cb = vi.fn()
    const unsubscribe = onClipboardBufferChange(cb)

    writeClipboardBuffer(payload('a'))
    expect(cb).toHaveBeenCalledTimes(1)

    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    expect(cb).toHaveBeenCalledTimes(2)

    // Unrelated key: ignored.
    window.dispatchEvent(new StorageEvent('storage', { key: 'some-other-key' }))
    expect(cb).toHaveBeenCalledTimes(2)

    // A full localStorage.clear() in another tab reports key: null — treated
    // as a change too.
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(cb).toHaveBeenCalledTimes(3)

    unsubscribe()
    writeClipboardBuffer(payload('b'))
    expect(cb).toHaveBeenCalledTimes(3)
  })

  it('never throws when writing and localStorage.setItem throws (quota/SecurityError)', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError')
    })

    const p = payload('still-works')
    expect(() => writeClipboardBuffer(p)).not.toThrow()
    // The in-memory slot still holds it even though the mirror write failed.
    expect(readClipboardBuffer<TestPayload>()).toEqual(p)
    expect(hasClipboardBuffer()).toBe(true)

    setItem.mockRestore()
  })

  it('never throws when reading and localStorage.getItem throws (SecurityError)', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('access denied', 'SecurityError')
    })

    expect(() => readClipboardBuffer()).not.toThrow()
    expect(readClipboardBuffer()).toBeNull()

    getItem.mockRestore()
  })
})
