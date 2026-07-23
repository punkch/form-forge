/**
 * CLI: regenerate the committed theme override stylesheets.
 *
 *   pnpm generate:theme
 *
 * Deliberate act — the output is committed and reviewed as a normal diff, and
 * drift-gated by tests/unit/theme-generated.spec.ts (unit suite) and
 * scripts/verify-webforms-bundle.mjs. Re-run after a PrimeVue / @primeuix bump,
 * an odkPreset change, or an accent tweak.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  accentContrastSteps,
  accentPrimary500,
  generateAccentAaCss,
  generateAccentContrastCss,
  generateAccentsCss,
  generateThemeDarkCss,
} from './theme-css-lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'src/styles/generated')

writeFileSync(join(outDir, 'theme-dark.css'), generateThemeDarkCss())
writeFileSync(join(outDir, 'theme-accents.css'), generateAccentsCss())
writeFileSync(join(outDir, 'theme-accents-aa.css'), generateAccentAaCss())
writeFileSync(join(outDir, 'theme-contrast-accents.css'), generateAccentContrastCss())

console.log('Wrote src/styles/generated/theme-dark.css + theme-accents.css + theme-accents-aa.css + theme-contrast-accents.css')
console.log('Accent primary-500:', accentPrimary500())
console.log('Accent AAA-clamp steps (per scheme):', accentContrastSteps())
