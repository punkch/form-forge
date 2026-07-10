import { describe, expect, it } from 'vitest'

import { detectEmbed } from '@/embed/detect'

// detectEmbed takes search/framed explicitly, so these run in the node unit
// environment without a `window`. The memoized embedDetection() wrapper is
// exercised at app boot (main.ts, router) against the real window.
describe('detectEmbed', () => {
  it('is active only when embed=1 AND the page is framed', () => {
    expect(detectEmbed('?embed=1', true)).toEqual({ active: true, origin: null })
    // Framed but no embed flag, or embed flag but not framed → inactive.
    expect(detectEmbed('?embed=1', false)).toEqual({ active: false, origin: null })
    expect(detectEmbed('', true)).toEqual({ active: false, origin: null })
    expect(detectEmbed('?embed=0', true)).toEqual({ active: false, origin: null })
  })

  it('pins a concrete origin param when active', () => {
    expect(detectEmbed('?embed=1&origin=https://host.example', true))
      .toEqual({ active: true, origin: 'https://host.example' })
  })

  it('leaves origin null when the param is absent or empty', () => {
    expect(detectEmbed('?embed=1&origin=', true)).toEqual({ active: true, origin: null })
    expect(detectEmbed('?embed=1', true)).toEqual({ active: true, origin: null })
  })

  it('never pins an origin while inactive, even if the param is present', () => {
    expect(detectEmbed('?embed=1&origin=https://evil.example', false))
      .toEqual({ active: false, origin: null })
  })

  it('ignores an origin that only appears in the hash (search is authoritative)', () => {
    // The app is hash-routed: a URL like /?embed=1#/x?origin=https://evil.example
    // yields search '?embed=1' — the hash's origin= is never parsed.
    expect(detectEmbed('?embed=1', true)).toEqual({ active: true, origin: null })
  })
})
