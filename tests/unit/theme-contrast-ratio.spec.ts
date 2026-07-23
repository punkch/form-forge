// Ratio-enforcing safety net for the HAND-AUTHORED src/styles/builder-contrast.css
// — the role tests/unit/theme-generated.spec.ts's byte-identity drift gate
// plays for the generated files, but for a file nothing regenerates. Parses
// the CSS as text (no CSS parser dependency), extracts the declared value for
// a small, hand-maintained token list mirroring exactly what
// src/styles/builder-contrast.css declares, and asserts WCAG ratios so a
// future hand-edit can't silently regress below AAA.
//
// Scope note (see the spec's Task 8): every token checked here is declared as
// a literal `#rrggbb` in builder-contrast.css itself (not a `var(--p-…)`
// reference) — --odk-text-color, --odk-muted-text-color, --odk-border-color,
// and --odk-base-background-color. The accent-derived tokens
// (--odk-primary-text-color etc, which redirect to `var(--p-primary-color)`)
// are deliberately OUT of scope for this literal-hex parser; their own AAA
// guarantee is covered by generateAccentContrastCss()'s self-consistency test
// in tests/unit/theme-generated.spec.ts instead. A future contributor adding a
// new literal-hex token to the surface/text/border set here should extend the
// KNOWN_TOKENS list below, or it silently escapes this ratio check.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { contrastRatio } from '../../scripts/theme-css-lib.mjs'
import { HIGH_CONTRAST_SURFACES } from '../../src/theme/constants'

const root = fileURLToPath(new URL('../..', import.meta.url))
const css = readFileSync(join(root, 'src/styles/builder-contrast.css'), 'utf8')

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** The exact-selector block's `{ ... }` body (not a descendant/compound rule
 * that merely starts with the same attribute selectors). */
const block = (selector: string): string => {
  const re = new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]*)\\}`)
  const m = re.exec(css)
  if (m === null) throw new Error(`builder-contrast.css: no block found for selector "${selector}"`)
  return m[1]
}

const decl = (blockBody: string, prop: string): string => {
  const re = new RegExp(`${escapeRegExp(prop)}:\\s*([^;]+);`)
  const m = re.exec(blockBody)
  if (m === null) throw new Error(`builder-contrast.css: no declaration found for "${prop}"`)
  return m[1].trim()
}

const LIGHT_SELECTOR = ":root[data-ff-contrast='high']"
const DARK_SELECTOR = ":root[data-ff-theme='dark'][data-ff-contrast='high']"

const lightBlock = block(LIGHT_SELECTOR)
const darkBlock = block(DARK_SELECTOR)

describe('builder-contrast.css — light-scheme block ratios', () => {
  const bg = decl(lightBlock, '--odk-base-background-color')
  const text = decl(lightBlock, '--odk-text-color')
  const mutedText = decl(lightBlock, '--odk-muted-text-color')
  const border = decl(lightBlock, '--odk-border-color')
  const successColor = decl(lightBlock, '--p-button-text-success-color')

  it('declares literal #rrggbb values (not var() references) for the checked tokens', () => {
    for (const v of [bg, text, mutedText, border, successColor]) expect(v).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('--odk-text-color vs --odk-base-background-color clears AAA (7:1)', () => {
    expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(7)
  })

  it('--odk-muted-text-color vs --odk-base-background-color clears AAA (7:1)', () => {
    expect(contrastRatio(mutedText, bg)).toBeGreaterThanOrEqual(7)
  })

  it('--odk-border-color vs --odk-base-background-color clears AA non-text (3:1)', () => {
    expect(contrastRatio(border, bg)).toBeGreaterThanOrEqual(3)
  })

  it('--p-button-text-success-color vs --odk-base-background-color clears AAA (7:1)', () => {
    expect(contrastRatio(successColor, bg)).toBeGreaterThanOrEqual(7)
  })

  it('the background/text pair matches HIGH_CONTRAST_SURFACES.light exactly (single source of truth)', () => {
    expect(bg).toBe(HIGH_CONTRAST_SURFACES.light.bg)
    expect(text).toBe(HIGH_CONTRAST_SURFACES.light.text)
  })
})

describe('builder-contrast.css — dark-scheme compound block ratios', () => {
  const bg = decl(darkBlock, '--odk-base-background-color')
  const text = decl(darkBlock, '--odk-text-color')
  const mutedText = decl(darkBlock, '--odk-muted-text-color')
  const border = decl(darkBlock, '--odk-border-color')
  const successColor = decl(darkBlock, '--p-button-text-success-color')

  it('declares literal #rrggbb values (not var() references) for the checked tokens', () => {
    for (const v of [bg, text, mutedText, border, successColor]) expect(v).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('--odk-text-color vs --odk-base-background-color clears AAA (7:1)', () => {
    expect(contrastRatio(text, bg)).toBeGreaterThanOrEqual(7)
  })

  it('--odk-muted-text-color vs --odk-base-background-color clears AAA (7:1)', () => {
    expect(contrastRatio(mutedText, bg)).toBeGreaterThanOrEqual(7)
  })

  it('--odk-border-color vs --odk-base-background-color clears AA non-text (3:1)', () => {
    expect(contrastRatio(border, bg)).toBeGreaterThanOrEqual(3)
  })

  it('--p-button-text-success-color vs --odk-base-background-color clears AAA (7:1)', () => {
    expect(contrastRatio(successColor, bg)).toBeGreaterThanOrEqual(7)
  })

  it('the background/text pair matches HIGH_CONTRAST_SURFACES.dark exactly (single source of truth)', () => {
    expect(bg).toBe(HIGH_CONTRAST_SURFACES.dark.bg)
    expect(text).toBe(HIGH_CONTRAST_SURFACES.dark.text)
  })
})

describe('builder-contrast.css — structural expectations', () => {
  it('redirects the primary aliases through the applied semantic tokens (accent-agnostic)', () => {
    expect(decl(lightBlock, '--odk-primary-text-color')).toBe('var(--p-primary-color)')
    expect(decl(lightBlock, '--odk-primary-border-color')).toBe('var(--p-primary-color)')
  })

  it('removes the primary "light background" tint fills (decoration reduction)', () => {
    expect(decl(lightBlock, '--odk-primary-light-background-color')).toBe('transparent')
    expect(decl(lightBlock, '--odk-primary-lighter-background-color')).toBe('transparent')
  })

  it('removes every category tint fill', () => {
    for (const cat of ['input', 'select', 'datetime', 'media', 'location', 'display', 'structure', 'meta']) {
      expect(decl(lightBlock, `--builder-cat-${cat}-tint`)).toBe('transparent')
    }
  })

  it('flattens the drawer/card box-shadows to a hard, spread-only outline (no blur)', () => {
    for (const prop of ['--builder-drawer-shadow', '--builder-card-shadow']) {
      const value = decl(lightBlock, prop)
      expect(value).toMatch(/^0 0 0 \d+px /) // offsets/blur both zero, spread only
    }
  })

  it('registers a thicker, fixed-colour :focus-visible ring for both schemes', () => {
    expect(css).toMatch(/:root\[data-ff-contrast='high'\]\s+:focus-visible\s*\{[^}]*outline:\s*3px solid/)
    expect(css).toMatch(/:root\[data-ff-theme='dark'\]\[data-ff-contrast='high'\]\s+:focus-visible/)
  })

  it('converts the category type-chip tint to a border, keyed off currentColor', () => {
    const rule = /:root\[data-ff-contrast='high'\]\s+\.type-chip\s*\{([^}]*)\}/.exec(css)
    expect(rule).not.toBeNull()
    const body = (rule as RegExpExecArray)[1]
    expect(body).toMatch(/background:\s*transparent/)
    expect(body).toMatch(/border:\s*1px solid currentColor/)
  })
})

describe('builder-contrast.css — accent-alias redirect vs the normal-mode AA clamp', () => {
  // The AA clamp (generated/theme-accents-aa.css) sets --odk-primary-* to
  // LITERAL AA-floor colours at 0,3,0. High contrast must re-assert the
  // var(--p-primary-color) redirect at the same specificity, and it only wins
  // that tie because builder-contrast.css is imported after the generated
  // file — pin the rule AND the import order.
  const redirectBlock = block(":root[data-ff-contrast='high'][data-ff-accent]")

  it('re-asserts both accent-as-text aliases at 0,3,0', () => {
    expect(decl(redirectBlock, '--odk-primary-text-color')).toBe('var(--p-primary-color)')
    expect(decl(redirectBlock, '--odk-primary-border-color')).toBe('var(--p-primary-color)')
  })

  it('keeps the load-bearing import order in main.ts (AA file before this one)', () => {
    const main = readFileSync(join(root, 'src/main.ts'), 'utf8')
    const aa = main.indexOf('generated/theme-accents-aa.css')
    const contrast = main.indexOf('styles/builder-contrast.css')
    expect(aa).toBeGreaterThan(-1)
    expect(contrast).toBeGreaterThan(aa)
  })
})
