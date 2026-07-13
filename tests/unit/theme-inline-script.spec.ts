// No-FOUC inline-script agreement pin — node env, reads index.html as text.
// The pre-paint <script> in index.html duplicates a slice of src/theme by hand
// (it must be dependency-free to run before the bundle). This test asserts it
// stays in lockstep with the source of truth in src/theme/constants.ts.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { ACCENTS, DEFAULT_ACCENT, DEFAULT_THEME, THEME_SCHEMES } from '@/theme/constants'

const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8')

// The bootstrap is the only attribute-less <script> in the document; the app
// entry is <script type="module" src="…"> and won't match.
const inlineScript = (() => {
  const match = /<script>([\s\S]*?)<\/script>/.exec(html)
  if (match === null) throw new Error('no inline <script> found in index.html')
  return match[1]
})()

describe('no-FOUC inline theme bootstrap', () => {
  it('reads from the same localStorage key as the ui store', () => {
    expect(inlineScript).toContain('odk-builder:ui:v1')
  })

  it('stamps the data-ff-theme and data-ff-accent attributes src/theme keys on', () => {
    expect(inlineScript).toContain('data-ff-theme')
    expect(inlineScript).toContain('data-ff-accent')
  })

  it('validates a persisted theme against every declared scheme', () => {
    for (const scheme of THEME_SCHEMES) {
      expect(inlineScript, scheme).toContain(`'${scheme}'`)
    }
  })

  it('falls back to the same theme/accent defaults as the store', () => {
    expect(inlineScript).toMatch(new RegExp(`theme\\s*=\\s*'${DEFAULT_THEME}'`))
    expect(inlineScript).toMatch(new RegExp(`accent\\s*=\\s*'${DEFAULT_ACCENT}'`))
  })

  it('carries an accent hex map that matches ACCENTS entry for entry', () => {
    for (const accent of ACCENTS) {
      // Each id must be paired with exactly its hex500 in the script's map.
      expect(inlineScript, accent.id).toMatch(new RegExp(`${accent.id}\\s*:\\s*'${accent.hex500}'`))
    }
  })

  it('does not reference an accent id that ACCENTS does not declare', () => {
    // Extract the ACCENTS object literal from the script and compare its keys.
    const objMatch = /ACCENTS\s*=\s*\{([^}]*)\}/.exec(inlineScript)
    expect(objMatch).not.toBeNull()
    const keys = [...(objMatch as RegExpExecArray)[1].matchAll(/(\w+)\s*:/g)].map((m) => m[1])
    expect(keys.sort()).toEqual(ACCENTS.map((a) => a.id).sort())
  })

  it('uses the same dark theme-color as the runtime controller', () => {
    // src/theme/index.ts hard-codes DARK_THEME_COLOR = '#0f172a'; the inline
    // script must match so the pre-paint browser-chrome colour agrees.
    expect(inlineScript).toContain('#0f172a')
  })

  it('version-gates the persisted blob like the ui store (STORAGE_VERSION 1)', () => {
    // A future STORAGE_VERSION bump must discard the old blob here too, or the
    // pre-paint stamp would disagree with the store on the first post-bump load.
    expect(inlineScript).toMatch(/pref\.version\s*===\s*1/)
  })
})
