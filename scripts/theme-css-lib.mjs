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
