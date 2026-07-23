// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { applyToClipboardEvent, payloadFromClipboardEvent, writeSystemClipboard } from './system'

/** happy-dom's ClipboardEvent/DataTransfer support is unreliable — the specs
 * use a hand-rolled fake, same pattern as use-selection-actions.spec.ts. */
const fakeEvent = (data: Record<string, string> = {}): ClipboardEvent => {
  const store = { ...data }
  return {
    clipboardData: {
      setData: (type: string, value: string) => { store[type] = value },
      getData: (type: string) => store[type] ?? '',
    },
  } as unknown as ClipboardEvent
}

const stubClipboard = (writeText: (text: string) => Promise<void>): void => {
  vi.stubGlobal('navigator', { clipboard: { writeText } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('writeSystemClipboard', () => {
  it('writes the serialized payload through the async Clipboard API', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)
    writeSystemClipboard('{"kind":"formforge-nodes"}')
    expect(writeText).toHaveBeenCalledWith('{"kind":"formforge-nodes"}')
  })

  it('swallows a rejected write (permission denied / unfocused document)', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('Not allowed', 'NotAllowedError'))
    stubClipboard(writeText)
    writeSystemClipboard('payload')
    // Flush the rejection through the microtask queue — an unhandled
    // rejection would fail the test run.
    await Promise.resolve()
    await Promise.resolve()
    expect(writeText).toHaveBeenCalledOnce()
  })

  it('no-ops when the Clipboard API is unavailable', () => {
    vi.stubGlobal('navigator', {})
    expect(() => { writeSystemClipboard('payload') }).not.toThrow()
  })
})

describe('applyToClipboardEvent / payloadFromClipboardEvent', () => {
  it('round-trips via application/json', () => {
    const event = fakeEvent()
    applyToClipboardEvent(event, '{"a":1}')
    expect(payloadFromClipboardEvent(event)).toBe('{"a":1}')
  })

  it('falls back to text/plain when no json entry is present', () => {
    expect(payloadFromClipboardEvent(fakeEvent({ 'text/plain': 'plain' }))).toBe('plain')
  })

  it('returns null when the event carries nothing', () => {
    expect(payloadFromClipboardEvent(fakeEvent())).toBeNull()
    expect(payloadFromClipboardEvent({ clipboardData: null } as unknown as ClipboardEvent)).toBeNull()
  })
})
