import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  accentPrimary500,
  contrastRatio,
  generateAccentContrastCss,
  generateAccentsCss,
  generateThemeDarkCss,
} from '../../scripts/theme-css-lib.mjs'
import {
  extractDarkModeSelector,
  readBundleSources,
} from '../../scripts/webforms-bundle-lib.mjs'
import { ACCENT_IDS, ACCENTS } from '../../src/theme/constants'

const root = fileURLToPath(new URL('../..', import.meta.url))
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8')

describe('generated theme CSS drift guards', () => {
  it('theme-dark.css is byte-identical to generateThemeDarkCss()', () => {
    expect(read('src/styles/generated/theme-dark.css')).toBe(generateThemeDarkCss())
  })

  it('theme-accents.css is byte-identical to generateAccentsCss()', () => {
    expect(read('src/styles/generated/theme-accents.css')).toBe(generateAccentsCss())
  })

  it('accentPrimary500() matches every hex500 swatch in ACCENTS', () => {
    const rendered = accentPrimary500()
    for (const accent of ACCENTS) {
      expect(rendered[accent.id], `accent ${accent.id}`).toBe(accent.hex500)
    }
  })

  it('web-forms installs PrimeVue with darkModeSelector:false', () => {
    expect(extractDarkModeSelector(readBundleSources())).toBe('false')
  })

  it('theme-contrast-accents.css is byte-identical to generateAccentContrastCss()', () => {
    expect(read('src/styles/generated/theme-contrast-accents.css')).toBe(generateAccentContrastCss())
  })
})

describe('generateAccentContrastCss() self-consistency', () => {
  // Parse each per-accent×scheme compound block's --p-primary-color and
  // --p-primary-contrast-color out of the generated CSS and assert the chosen
  // contrast text actually clears AAA (7:1) against its own chosen background
  // — independent of tests/unit/theme-contrast-ratio.spec.ts, which checks the
  // hand-authored *surface* layer instead of this generated *accent* layer.
  // Strip the leading /* GENERATED FILE ... */ header comment before splitting
  // into rule blocks — it precedes the first selector and has no braces of its
  // own, so the block-splitting regex would otherwise fold it into block 1.
  const css = generateAccentContrastCss().replace(/^\/\*[\s\S]*?\*\/\n/, '')
  const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    decls: Object.fromEntries(
      [...m[2].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()])
    ),
  }))

  it('emits one compound block per accent for both the light and dark-compound selector shapes', () => {
    expect(blocks.length).toBe(ACCENT_IDS.length * 2)
    for (const id of ACCENT_IDS) {
      expect(blocks.some((b) => b.selector === `:root[data-ff-contrast="high"][data-ff-accent="${id}"]`)).toBe(true)
      expect(
        blocks.some((b) => b.selector === `:root[data-ff-theme="dark"][data-ff-contrast="high"][data-ff-accent="${id}"]`)
      ).toBe(true)
    }
  })

  it('every emitted --p-primary-contrast-color clears AAA (7:1) against its own --p-primary-color', () => {
    for (const { selector, decls } of blocks) {
      const bg = decls['--p-primary-color']
      const text = decls['--p-primary-contrast-color']
      expect(bg, selector).toMatch(/^#[0-9a-f]{6}$/)
      expect(text, selector).toMatch(/^#[0-9a-f]{6}$/)
      expect(contrastRatio(text, bg), `${selector} contrast-color vs primary-color`).toBeGreaterThanOrEqual(7)
    }
  })

  it('every emitted --p-highlight-color clears AAA (7:1) against its own --p-highlight-background', () => {
    for (const { selector, decls } of blocks) {
      const bg = decls['--p-highlight-background']
      const text = decls['--p-highlight-color']
      expect(contrastRatio(text, bg), `${selector} highlight-color vs highlight-background`).toBeGreaterThanOrEqual(7)
    }
  })

  it('hover/active collapse to the same value as the base primary colour (decoration reduction)', () => {
    for (const { selector, decls } of blocks) {
      expect(decls['--p-primary-hover-color'], selector).toBe(decls['--p-primary-color'])
      expect(decls['--p-primary-active-color'], selector).toBe(decls['--p-primary-color'])
    }
  })
})
