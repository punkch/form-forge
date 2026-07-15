import { describe, expect, it } from 'vitest'

import { newDocument } from '@/core/model/factory'

import { contentFingerprint } from './fingerprint'

describe('contentFingerprint', () => {
  it('is deterministic for the same document', async () => {
    const doc = newDocument('Survey')
    expect(await contentFingerprint(doc)).toBe(await contentFingerprint(doc))
  })

  it('ignores the version string — a bump is not content drift', async () => {
    const doc = newDocument('Survey')
    const bumped = { ...doc, settings: { ...doc.settings, version: '99999999' } }
    expect(await contentFingerprint(bumped)).toBe(await contentFingerprint(doc))
  })

  it('does not mutate the input document', async () => {
    const doc = newDocument('Survey')
    const before = doc.settings.version
    await contentFingerprint(doc)
    expect(doc.settings.version).toBe(before)
  })

  it('changes when the content changes', async () => {
    const a = newDocument('Survey A')
    const b = newDocument('Survey B')
    expect(await contentFingerprint(a)).not.toBe(await contentFingerprint(b))
  })

  it('returns a 64-char lowercase hex SHA-256 digest', async () => {
    const hash = await contentFingerprint(newDocument('Survey'))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})
