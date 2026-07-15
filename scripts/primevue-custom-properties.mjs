/**
 * Enumerate every PrimeVue design-token custom property (`--p-*`) that the
 * pinned `@primeuix/styled` emission produces for `odkPreset`, as an importFrom
 * source for stylelint's `value-no-unknown-custom-properties` rule.
 *
 * These tokens are injected into the document by the PrimeVue runtime (styled
 * mode) — they never appear in a static source stylesheet — so without this the
 * rule would flag all ~500 in-repo `var(--p-…)` usages as unknown. Deriving them
 * live from the same pinned packages the theme generator uses means the allowlist
 * cannot drift out of sync with the installed PrimeVue.
 *
 * Node imports `odk-preset.ts` via type-stripping (no build step) — same pattern
 * as scripts/theme-css-lib.mjs. The rule only checks key presence, so values are
 * left empty.
 */
import { Theme } from '@primeuix/themes'

import { odkPreset } from '../src/styles/odk-preset.ts'

/** Collect `--p-*` property names declared in a token stylesheet into `into`. */
const scrape = (css, into) => {
  for (const m of (css ?? '').matchAll(/(--p-[a-z0-9-]+)\s*:/g)) into[m[1]] = ''
}

/**
 * @returns {Promise<{ customProperties: Record<string, string> }>} every `--p-*`
 *   token name the preset emits (primitive + semantic + global + all components).
 */
export async function primevueCustomProperties () {
  Theme.setTheme({
    preset: odkPreset,
    options: { prefix: 'p', darkModeSelector: '.ff-stylelint', cssLayer: false },
  })

  const customProperties = {}
  const common = Theme.getCommon('', {})
  scrape(common.primitive?.css, customProperties)
  scrape(common.semantic?.css, customProperties)
  scrape(common.global?.css, customProperties)
  for (const name of Object.keys(Theme.getPreset().components ?? {})) {
    scrape(Theme.getComponent(name, {}).css, customProperties)
  }
  return { customProperties }
}
