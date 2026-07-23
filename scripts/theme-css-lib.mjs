/**
 * Theme CSS generator (library).
 *
 * Produces the committed static override stylesheets that deliver dark mode and
 * accent presets WITHOUT enabling PrimeVue's runtime dark mode. Both this app
 * and @getodk/web-forms install PrimeVue with `darkModeSelector: false`; the
 * live preview mounts a *second* PrimeVue runtime in the same document that
 * rewrites the shared `<style data-primevue-style-id>` elements every time it
 * mounts. Any dark CSS emitted into those elements would be clobbered.
 *
 * Instead we run the pinned @primeuix/styled emission ourselves against
 * `odkPreset` (whose inert `colorScheme.dark` block is only read here) with the
 * dark selector `:root[data-ff-theme="dark"]` and keep ONLY the dark rules. That
 * selector has specificity (0,2,0) so it beats both runtimes' plain `:root`
 * (0,1,0) injections regardless of order, and it lives in a Vite-owned
 * stylesheet PrimeVue never touches — immune to the clobber.
 *
 * Pure/deterministic: no filesystem, no Date/random. The CLI wrapper
 * (generate-theme-css.mjs) writes the output; tests/unit/theme-generated.spec.ts
 * re-runs these functions and asserts the committed files are up to date.
 *
 * Plain JS (+ hand-written theme-css-lib.d.mts) — same pattern as
 * webforms-bundle-lib.mjs — so vue-tsc never has to resolve the Node-24
 * explicit-extension `.ts` imports below. Run via `node` (type stripping).
 */
import { Theme, palette } from '@primeuix/themes'

import { odkPreset } from '../src/styles/odk-preset.ts'
import { HIGH_CONTRAST_SURFACES, NORMAL_AA_SURFACES } from '../src/theme/constants.ts'

/** The dark-mode selector the generated rules are keyed on. */
export const DARK_SELECTOR = ':root[data-ff-theme="dark"]'

const HEADER = (kind) =>
  '/*\n * GENERATED FILE — do not edit by hand.\n' +
  ` * ${kind}\n` +
  ' * Regenerate with: pnpm generate:theme\n' +
  ' * Source: scripts/theme-css-lib.mjs + src/styles/odk-preset.ts + src/theme/constants.ts\n' +
  ' * Drift-gated by tests/unit/theme-generated.spec.ts and scripts/verify-webforms-bundle.mjs\n */\n'

/** Split a flat token stylesheet into its rule blocks (no nested braces). */
const ruleBlocks = (css) => {
  const out = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(css)) !== null) {
    out.push({ selector: m[1].trim(), block: m[0] })
  }
  return out
}

/**
 * Guard `ruleBlocks`' flat-stylesheet assumption. The pinned emission only ever
 * produces top-level `selector{...}` rules (token maps), so any nested braces —
 * an `@media`/`@keyframes`/`@layer` a future PrimeVue bump might emit — would
 * make the regex mis-split and silently drop dark rules. Fail loudly instead.
 */
const assertFlat = (css, where) => {
  if (!css) return
  const residue = css.replace(/[^{}]*\{[^{}]*\}/g, '')
  if (residue.includes('{') || residue.includes('}')) {
    throw new Error(`theme-css-lib: non-flat CSS from ${where} (nested/at-rule braces) — the dark-rule extractor would mis-split. Update the generator.`)
  }
}

/** Keep only the rule blocks whose selector targets the dark scheme. */
const darkCss = (css, where) => {
  assertFlat(css, where)
  return ruleBlocks(css ?? '')
    .filter((r) => r.selector.includes('data-ff-theme'))
    .map((r) => r.block)
    .join('\n')
}

/**
 * Generate the dark-scheme override CSS: dark semantic tokens, the `color-scheme`
 * global, and every Aura component's dark token map. The primitive palette
 * (`--p-slate-*`, `--p-red-*`, …) the rules reference is emitted by the PrimeVue
 * runtime's own `:root {}` block, so it is deliberately excluded here.
 */
export const generateThemeDarkCss = () => {
  Theme.setTheme({
    preset: odkPreset,
    options: { prefix: 'p', darkModeSelector: DARK_SELECTOR, cssLayer: false },
  })

  const parts = []
  const common = Theme.getCommon('', {})
  const semantic = darkCss(common.semantic?.css, 'semantic')
  const global = darkCss(common.global?.css, 'global')
  if (semantic) parts.push(semantic)
  if (global) parts.push(global)

  const components = Object.keys(Theme.getPreset().components ?? {})
  for (const name of components) {
    const dark = darkCss(Theme.getComponent(name, {}).css, `component ${name}`)
    if (dark) parts.push(dark)
  }

  return HEADER('Dark theme: overrides for :root[data-ff-theme="dark"].') + parts.join('\n') + '\n'
}

/**
 * Accent presets. Each non-default accent overrides only the `--p-primary-*`
 * palette (produced by @primeuix/themes `palette()` — pure build-time hex math),
 * so it re-tints chrome + preview in BOTH schemes for free: the dark map already
 * references `var(--p-primary-400)` etc.
 *
 * `contrast` is set only where white-on-500 fails WCAG AA (amber): the button
 * label token is remapped to dark text (`--p-surface-900`), which reads in both
 * schemes since the accent stays light there. Green uses an AA-nudged anchor
 * (darker than the raw #16A34A so white text clears AA) per product decision.
 */
export const ACCENT_GEN = [
  { id: 'purple', anchor: '#6366f1' },
  { id: 'green', anchor: '#0f7c39' },
  { id: 'teal', anchor: '#0d9488' },
  { id: 'amber', anchor: '#f59e0b', contrast: 'var(--p-surface-900)' },
  { id: 'rose', anchor: '#e11d48' },
]

/** Effective primary-500 each accent renders (for cross-checking the swatch). */
export const accentPrimary500 = () => {
  const out = { blue: '#3e9fcc' }
  for (const a of ACCENT_GEN) {
    const scale = palette(a.anchor)
    out[a.id] = scale[500]
  }
  return out
}

export const generateAccentsCss = () => {
  const parts = []
  for (const a of ACCENT_GEN) {
    const scale = palette(a.anchor)
    const decls = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
      .map((step) => `--p-primary-${step}:${scale[step]};`)
      .join('')
    const contrast = a.contrast ? `--p-primary-contrast-color:${a.contrast};` : ''
    parts.push(`:root[data-ff-accent="${a.id}"]{${decls}${contrast}}`)
  }
  return HEADER('Accent presets: primary-scale overrides per :root[data-ff-accent="…"].') + parts.join('\n') + '\n'
}

// --- High-contrast accent clamping ----------------------------------------
//
// Dependency-free WCAG 2 relative-luminance + contrast-ratio helpers (no npm
// package — this is ~15 lines of hex math, per the shaping decision). Shared
// by generateAccentContrastCss() below AND by
// tests/unit/theme-contrast-ratio.spec.ts, which reuses `contrastRatio` to
// enforce the hand-authored surface CSS's ratios rather than duplicating the
// math there.

/** Parse '#rrggbb' to [r,g,b] in [0,255]. */
const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

/** sRGB channel (0-255) to its linear-light value per the WCAG 2 formula. */
const linearizeChannel = (channel255) => {
  const c = channel255 / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG 2 relative luminance of a '#rrggbb' colour. */
export const relativeLuminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(linearizeChannel)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2 contrast ratio between two '#rrggbb' colours, in [1, 21]. */
export const contrastRatio = (hexA, hexB) => {
  const lighter = Math.max(relativeLuminance(hexA), relativeLuminance(hexB))
  const darker = Math.min(relativeLuminance(hexA), relativeLuminance(hexB))
  return (lighter + 0.05) / (darker + 0.05)
}

const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
const AAA_FLOOR = 7
/** WCAG AA floor for the normal-mode accent clamp (generateAccentAaCss). */
const AA_FLOOR = 4.5

/**
 * All six accents' anchor hexes, for the contrast generator only.
 * generateAccentsCss()/ACCENT_GEN deliberately cover only the five non-default
 * accents (blue emits no NORMAL-mode override, since it IS the base ODK
 * scale) — that five-entry list and its blue-skip behaviour are a pinned
 * invariant (tests/unit/theme-generated.spec.ts) and stay untouched. Under
 * high contrast blue's base scale is just as un-clamped as any other accent's,
 * so it needs a clamp block here too — hence this separate, six-entry list.
 */
const ALL_ACCENT_ANCHORS = [
  { id: 'blue', anchor: '#3e9fcc' },
  ...ACCENT_GEN.map(({ id, anchor }) => ({ id, anchor })),
]

/**
 * Walk an accent's 50–950 scale outward from its natural 500 anchor towards
 * whichever end (50 or 950) is darker/lighter than `bgHex` needs, returning
 * the LEAST extreme step that still clears `floor` against `bgHex` —
 * preserving as much of the accent's original hue as the floor allows,
 * mirroring what the amber `contrast` field already did by hand. `floor`
 * defaults to the AAA floor (7:1, the high-contrast clamp's requirement);
 * the normal-mode AA clamp (generateAccentAaCss) passes AA_FLOOR (4.5)
 * instead.
 */
const pickClampStep = (scale, bgHex, floor = AAA_FLOOR) => {
  const midIndex = SCALE_STEPS.indexOf(500)
  const towardDark = contrastRatio(scale[950], bgHex) >= contrastRatio(scale[50], bgHex)
  const order = towardDark
    ? SCALE_STEPS.slice(midIndex)
    : SCALE_STEPS.slice(0, midIndex + 1).reverse()
  for (const step of order) {
    if (contrastRatio(scale[step], bgHex) >= floor) return step
  }
  // Every step in the scale is monotonic towards bg in this direction, so the
  // most extreme step is the best available even if it somehow still falls
  // short (it won't, for #ffffff/#000000 surfaces and any realistic anchor).
  return order[order.length - 1]
}

/** Whichever of the two high-contrast surface texts reads better on `bgHex`. */
const pickContrastText = (bgHex) => {
  const { light, dark } = HIGH_CONTRAST_SURFACES
  return contrastRatio(dark.text, bgHex) >= contrastRatio(light.text, bgHex) ? dark.text : light.text
}

/**
 * Per accent × scheme, clamp the *applied* PrimeVue primary tokens (not the
 * whole 50–950 scale) to whichever step of the accent's own scale clears the
 * AAA floor against that scheme's high-contrast surface — so every accent
 * stays recognizably itself (just muted at the extreme end) while every
 * consumer of `--p-primary-color`/`--p-highlight-*` is guaranteed AAA.
 *
 * Hover/active intentionally collapse to the SAME clamped value as the base
 * colour (no separate lighter/darker shade): high contrast already trades
 * subtlety for guaranteed legibility everywhere else (flattened shadows,
 * tint-less category chips), and reusing one value sidesteps any risk of a
 * neighbouring scale step accidentally falling back under the floor.
 *
 * The `--odk-primary-*` odk-tokens.css aliases are NOT repointed here: they
 * are redirected once, accent-agnostically, in the hand-authored
 * src/styles/builder-contrast.css (`--odk-primary-text-color: var(--p-primary-
 * color)` etc) — a live var() reference that automatically picks up whichever
 * accent's clamp is active, without a 6×2 duplicate declaration in this file.
 */
export const generateAccentContrastCss = () => {
  const schemes = [
    {
      selector: (id) => `:root[data-ff-contrast="high"][data-ff-accent="${id}"]`,
      bg: HIGH_CONTRAST_SURFACES.light.bg,
    },
    {
      selector: (id) => `:root[data-ff-theme="dark"][data-ff-contrast="high"][data-ff-accent="${id}"]`,
      bg: HIGH_CONTRAST_SURFACES.dark.bg,
    },
  ]
  const parts = []
  for (const { selector, bg } of schemes) {
    for (const { id, anchor } of ALL_ACCENT_ANCHORS) {
      const scale = palette(anchor)
      const step = pickClampStep(scale, bg)
      const color = scale[step]
      const contrastText = pickContrastText(color)
      const decls =
        `--p-primary-color:${color};` +
        `--p-primary-hover-color:${color};` +
        `--p-primary-active-color:${color};` +
        `--p-primary-contrast-color:${contrastText};` +
        `--p-highlight-background:${color};` +
        `--p-highlight-color:${contrastText};`
      parts.push(`${selector(id)}{${decls}}`)
    }
  }
  return (
    HEADER(
      'High-contrast accent AAA clamps: per :root[data-ff-contrast="high"][data-ff-accent="…"] ' +
      '(+ the dark-scheme compound). Re-points only the APPLIED primary tokens, not the whole scale.'
    ) + parts.join('\n') + '\n'
  )
}

/** Effective AAA-clamped step chosen per accent × scheme (diagnostic log, mirrors accentPrimary500()). */
export const accentContrastSteps = () => {
  const bgs = { light: HIGH_CONTRAST_SURFACES.light.bg, dark: HIGH_CONTRAST_SURFACES.dark.bg }
  const out = {}
  for (const [scheme, bg] of Object.entries(bgs)) {
    out[scheme] = {}
    for (const { id, anchor } of ALL_ACCENT_ANCHORS) {
      out[scheme][id] = pickClampStep(palette(anchor), bg)
    }
  }
  return out
}

// --- Normal-mode (AA) accent clamping -------------------------------------
//
// Unlike the high-contrast AAA clamp above (which always applies — high
// contrast mode is opt-in and trades subtlety for guarantees everywhere), the
// NORMAL-mode accent scale is what every user sees by default, so a block is
// only emitted for an accent × scheme pair whose *currently applied* primary
// colour actually fails WCAG AA (4.5:1) against that scheme's worst-case
// surface. Passing accents are left untouched — no needless override.
//
// The applied colour per scheme mirrors what the rest of the generated/
// hand-authored CSS already does: light mode never overrides
// `--p-primary-color` (PrimeVue's own runtime `:root{}` sets it to the raw
// `--p-primary-500`), and builder-dark.css/theme-dark.css do the same at 400
// for dark. So "the applied colour" here is simply scale[500] (light) /
// scale[400] (dark) — matching odk-tokens.css's/builder-dark.css's
// `--odk-primary-text-color: var(--p-primary-500|400)` aliases.

/** Scheme configs the AA clamp walks: applied step + worst-case surface bg. */
const AA_SCHEMES = [
  {
    selector: (id) => `:root[data-ff-theme="light"][data-ff-accent="${id}"]`,
    bg: NORMAL_AA_SURFACES.light,
    appliedStep: 500,
  },
  {
    selector: (id) => `:root[data-ff-theme="dark"][data-ff-accent="${id}"]`,
    bg: NORMAL_AA_SURFACES.dark,
    appliedStep: 400,
  },
]

/**
 * Per accent × scheme, clamp the applied PrimeVue primary tokens (mirroring
 * generateAccentContrastCss()'s shape) PLUS the `--odk-primary-text-color`/
 * `--odk-primary-border-color` aliases — which in NORMAL mode point straight
 * at the raw `--p-primary-500`/`-400` step (see odk-tokens.css/
 * builder-dark.css), not at `--p-primary-color`, so they need their own
 * literal override here rather than the accent-agnostic var() redirect
 * builder-contrast.css uses for the high-contrast case.
 *
 * Hover/active continue ONE and TWO further steps in the SAME direction the
 * clamp already moved away from 500 (preserving a hover/active gradient
 * instead of collapsing them like the AAA clamp does), falling back to the
 * clamped value itself once the walk runs off the end of the 50–950 scale.
 */
export const generateAccentAaCss = () => {
  const midIndex = SCALE_STEPS.indexOf(500)
  const parts = []
  for (const { selector, bg, appliedStep } of AA_SCHEMES) {
    for (const { id, anchor } of ALL_ACCENT_ANCHORS) {
      const scale = palette(anchor)
      const applied = scale[appliedStep]
      if (contrastRatio(applied, bg) >= AA_FLOOR) continue // already AA-safe, no block

      const step = pickClampStep(scale, bg, AA_FLOOR)
      const color = scale[step]
      const contrastText = pickContrastText(color)

      const stepIndex = SCALE_STEPS.indexOf(step)
      const dirSign = stepIndex >= midIndex ? 1 : -1
      const stepToward = (offset) => {
        const idx = stepIndex + dirSign * offset
        return idx >= 0 && idx < SCALE_STEPS.length ? scale[SCALE_STEPS[idx]] : color
      }
      const hover = stepToward(1)
      const active = stepToward(2)

      const decls =
        `--p-primary-color:${color};` +
        `--p-primary-hover-color:${hover};` +
        `--p-primary-active-color:${active};` +
        `--p-primary-contrast-color:${contrastText};` +
        `--p-highlight-background:${color};` +
        `--p-highlight-color:${contrastText};` +
        `--odk-primary-text-color:${color};` +
        `--odk-primary-border-color:${color};`
      parts.push(`${selector(id)}{${decls}}`)
    }
  }
  return (
    HEADER(
      'Normal-mode accent AA clamps: per :root[data-ff-theme="…"][data-ff-accent="…"] — emitted ' +
      'ONLY where that accent\'s applied primary colour (the 500 step in light, 400 in dark) ' +
      'fails WCAG AA (4.5:1) against src/theme/constants.ts NORMAL_AA_SURFACES. Re-points the ' +
      'applied primary/highlight tokens plus the --odk-primary-* text/border aliases (which ' +
      'point at the raw 500/400 step, not --p-primary-color, in normal mode).'
    ) + parts.join('\n') + '\n'
  )
}
