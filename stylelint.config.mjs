/**
 * Stylelint — guards against references to CSS custom properties that are never
 * defined. An undefined `var(--x)` with no fallback silently invalidates the whole
 * declaration (collapsing a gap/padding to 0), which no other gate catches:
 * vue-tsc ignores CSS, eslint doesn't resolve custom properties, happy-dom has no
 * layout engine, and Playwright asserts on testids/text, not spacing.
 *
 * Known-property sources (importFrom):
 *  - our own tokens: odk-tokens.css (--odk-*), builder.css / builder-dark.css
 *    (--builder-*), and the generated theme overrides (--accent, dark/accent --p-*);
 *  - every PrimeVue --p-* token, computed live from the pinned @primeuix/styled
 *    emission (primevueCustomProperties) since those are injected at runtime.
 *
 * The rule ignores fallback-guarded refs — `var(--x, fallback)` is safe even when
 * --x is undefined — so only bare, undefined references are flagged.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { primevueCustomProperties } from './scripts/primevue-custom-properties.mjs'

const dir = path.dirname(fileURLToPath(import.meta.url))
const abs = (p) => path.join(dir, p)

/** @type {import('stylelint').Config} */
export default {
  plugins: ['stylelint-value-no-unknown-custom-properties'],
  overrides: [{ files: ['**/*.vue'], customSyntax: 'postcss-html' }],
  rules: {
    'csstools/value-no-unknown-custom-properties': [
      true,
      {
        importFrom: [
          abs('src/styles/odk-tokens.css'),
          abs('src/styles/builder.css'),
          abs('src/styles/builder-dark.css'),
          abs('src/styles/generated/theme-dark.css'),
          abs('src/styles/generated/theme-accents.css'),
          // Properties assigned at runtime via inline `:style` bindings, with no
          // static declaration to point at (unlike the --builder-* sizing vars,
          // which default in builder.css). Add here when a template `:style` sets
          // a new bare custom property that scoped CSS then reads.
          { customProperties: { '--accent-swatch-color': '' } },
          // A Promise resolving to { customProperties } — the plugin awaits it.
          primevueCustomProperties(),
        ],
      },
    ],
  },
}
