import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { palette } from '@primeuix/themes'
import { describe, expect, it } from 'vitest'

import {
  accentPrimary500,
  contrastRatio,
  generateAccentAaCss,
  generateAccentContrastCss,
  generateAccentsCss,
  generateThemeDarkCss,
} from '../../scripts/theme-css-lib.mjs'
import {
  extractDarkModeSelector,
  readBundleSources,
} from '../../scripts/webforms-bundle-lib.mjs'
import { ACCENT_IDS, ACCENTS, HIGH_CONTRAST_SURFACES, NORMAL_AA_SURFACES } from '../../src/theme/constants'

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

  it('theme-accents-aa.css is byte-identical to generateAccentAaCss()', () => {
    expect(read('src/styles/generated/theme-accents-aa.css')).toBe(generateAccentAaCss())
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

  it('every emitted --p-primary-color clears AAA (7:1) against its scheme\'s high-contrast surface', () => {
    // This is the clamp's actual purpose: builder-contrast.css re-points the
    // applied primary tokens at these values and uses them AS TEXT on the
    // high-contrast surface — a mis-picked palette step must fail here, not
    // only against its own contrast-color pair.
    for (const { selector, decls } of blocks) {
      const surface = selector.includes('[data-ff-theme="dark"]')
        ? HIGH_CONTRAST_SURFACES.dark.bg
        : HIGH_CONTRAST_SURFACES.light.bg
      expect(
        contrastRatio(decls['--p-primary-color'], surface),
        `${selector} primary-color vs high-contrast surface`
      ).toBeGreaterThanOrEqual(7)
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

describe('generateAccentAaCss() self-consistency', () => {
  // Same parsing approach as the AAA block above, but this generator emits a
  // block ONLY where the accent's applied colour fails AA — so blocks.length
  // varies with the palette, not a fixed accent-count multiple.
  const css = generateAccentAaCss().replace(/^\/\*[\s\S]*?\*\/\n/, '')
  const blocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    decls: Object.fromEntries(
      [...m[2].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()])
    ),
  }))

  const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
  const SCHEME_CONFIG = {
    light: { bg: NORMAL_AA_SURFACES.light, appliedStep: 500 },
    dark: { bg: NORMAL_AA_SURFACES.dark, appliedStep: 400 },
  } as const

  const findBlock = (scheme: 'light' | 'dark', id: string) =>
    blocks.find((b) => b.selector === `:root[data-ff-theme="${scheme}"][data-ff-accent="${id}"]`)

  it('every emitted block only targets a scheme-explicit selector (never accent-only, which would leak across schemes)', () => {
    for (const { selector } of blocks) {
      expect(selector, selector).toMatch(/^:root\[data-ff-theme="(light|dark)"\]\[data-ff-accent="[a-z]+"\]$/)
    }
  })

  it('every accent × scheme\'s RESOLVED applied primary colour clears AA (4.5:1) against NORMAL_AA_SURFACES', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const { bg, appliedStep } = SCHEME_CONFIG[scheme]
      for (const accent of ACCENTS) {
        const scale = palette(accent.hex500) as Record<number, string>
        const block = findBlock(scheme, accent.id)
        const resolved = block ? block.decls['--p-primary-color'] : scale[appliedStep]
        expect(resolved, `${scheme}/${accent.id}`).toMatch(/^#[0-9a-f]{6}$/)
        expect(
          contrastRatio(resolved, bg),
          `${scheme}/${accent.id} resolved primary vs NORMAL_AA_SURFACES`
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('every emitted --p-primary-contrast-color clears AA (4.5:1) against its own --p-primary-color', () => {
    for (const { selector, decls } of blocks) {
      const bg = decls['--p-primary-color']
      const text = decls['--p-primary-contrast-color']
      expect(bg, selector).toMatch(/^#[0-9a-f]{6}$/)
      expect(text, selector).toMatch(/^#[0-9a-f]{6}$/)
      expect(contrastRatio(text, bg), `${selector} contrast-color vs primary-color`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('every emitted --p-highlight-color clears AA (4.5:1) against its own --p-highlight-background', () => {
    for (const { selector, decls } of blocks) {
      const bg = decls['--p-highlight-background']
      const text = decls['--p-highlight-color']
      expect(contrastRatio(text, bg), `${selector} highlight-color vs highlight-background`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('hover/active are valid members of the accent\'s own 50-950 scale (or the clamped value itself at scale ends)', () => {
    for (const { selector, decls } of blocks) {
      const id = selector.match(/data-ff-accent="([a-z]+)"/)?.[1]
      const accent = ACCENTS.find((a) => a.id === id)
      expect(accent, selector).toBeTruthy()
      const scale = palette(accent!.hex500) as Record<number, string>
      const members = new Set([decls['--p-primary-color'], ...SCALE_STEPS.map((s) => scale[s])])
      expect(members.has(decls['--p-primary-hover-color']), `${selector} hover`).toBe(true)
      expect(members.has(decls['--p-primary-active-color']), `${selector} active`).toBe(true)
    }
  })

  it('the --odk-primary-text-color/--odk-primary-border-color aliases mirror the clamped primary colour', () => {
    for (const { selector, decls } of blocks) {
      expect(decls['--odk-primary-text-color'], selector).toBe(decls['--p-primary-color'])
      expect(decls['--odk-primary-border-color'], selector).toBe(decls['--p-primary-color'])
    }
  })
})
