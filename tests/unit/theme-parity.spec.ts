import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  bundledPrimeVueVersions,
  extractDarkModeSelector,
  extractOdkTokens,
  extractPrimaryScale,
  parseTokensCss,
  readBundleSources,
} from '../../scripts/webforms-bundle-lib.mjs'
import { ODK_PRIMARY_SCALE } from '../../src/styles/odk-preset'

const root = fileURLToPath(new URL('../..', import.meta.url))
const bundleSource: string = readBundleSources()

describe('theme parity with @getodk/web-forms', () => {
  it('odk-tokens.css matches the tokens injected by the bundle', () => {
    const bundleTokens: Map<string, string> = extractOdkTokens(bundleSource)
    const ourTokens: Map<string, string> = parseTokensCss(
      readFileSync(join(root, 'src/styles/odk-tokens.css'), 'utf8')
    )
    expect(bundleTokens.size).toBeGreaterThan(30)
    for (const [name, value] of bundleTokens) {
      expect(ourTokens.get(name), `token ${name}`).toBe(value)
    }
    for (const name of ourTokens.keys()) {
      expect(bundleTokens.has(name), `stale token ${name}`).toBe(true)
    }
  })

  it('odk-preset.ts primary scale matches the bundled preset', () => {
    const bundleScale = extractPrimaryScale(bundleSource)
    expect(bundleScale).not.toBeNull()
    expect(bundleScale).toMatchObject({ ...ODK_PRIMARY_SCALE })
  })

  it('our primevue pins match what web-forms was built against', () => {
    const versions = bundledPrimeVueVersions()
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(pkg.dependencies.primevue).toBe(versions.primevue)
    expect(pkg.dependencies['@primeuix/themes']).toBe(versions.themes)
  })

  it('the bundle installs PrimeVue with darkModeSelector:false', () => {
    // If web-forms ever ships the @primeuix default ("system"), PrimeVue would
    // inject competing media-query dark blocks that clobber our generated
    // :root[data-ff-theme="dark"] overrides.
    expect(extractDarkModeSelector(bundleSource)).toBe('false')
  })
})
