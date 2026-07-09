#!/usr/bin/env node
/**
 * Verifies that our copies of the ODK Web Forms design system match the
 * installed @getodk/web-forms bundle:
 *   - src/styles/odk-tokens.css vs the bundle's :root --odk-* block
 *   - src/styles/odk-preset.ts primary scale vs the bundled preset
 *   - our pinned primevue/@primeuix/themes vs what web-forms was built with
 * Exits 1 on any drift. Run after every web-forms upgrade.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  bundledPrimeVueVersions,
  extractOdkTokens,
  extractPrimaryScale,
  parseTokensCss,
  readBundleSources,
} from './webforms-bundle-lib.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0
const fail = (msg) => { failures++; console.error(`✘ ${msg}`) }
const ok = (msg) => console.log(`✔ ${msg}`)

const source = readBundleSources()

// 1. Token parity
const bundleTokens = extractOdkTokens(source)
const ourTokens = parseTokensCss(readFileSync(join(root, 'src/styles/odk-tokens.css'), 'utf8'))
for (const [name, value] of bundleTokens) {
  const ours = ourTokens.get(name)
  if (ours === undefined) fail(`token missing from odk-tokens.css: ${name}: ${value}`)
  else if (ours !== value) fail(`token drift ${name}: bundle="${value}" ours="${ours}"`)
}
for (const name of ourTokens.keys()) {
  if (!bundleTokens.has(name)) fail(`stale token in odk-tokens.css (not in bundle): ${name}`)
}
if (bundleTokens.size === 0) fail('no --odk-* tokens found in bundle — extraction broken?')
else if (failures === 0) ok(`${bundleTokens.size} --odk-* tokens match`)

// 2. Primary scale parity
const bundleScale = extractPrimaryScale(source)
const presetTs = readFileSync(join(root, 'src/styles/odk-preset.ts'), 'utf8')
if (bundleScale === null) {
  fail('could not locate the #3e9fcc primary scale in the bundle')
} else {
  for (const [step, hex] of Object.entries(bundleScale)) {
    if (!presetTs.toLowerCase().includes(hex)) {
      fail(`primary.${step} ${hex} not present in odk-preset.ts`)
    }
  }
  ok(`primary scale (${Object.keys(bundleScale).length} steps) present in odk-preset.ts`)
}

// 3. PrimeVue version pins
const versions = bundledPrimeVueVersions()
const ourPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
if (versions.primevue !== ourPkg.dependencies.primevue) {
  fail(`primevue pin drift: web-forms built with ${versions.primevue}, we pin ${ourPkg.dependencies.primevue}`)
} else ok(`primevue pinned to web-forms' ${versions.primevue}`)
if (versions.themes !== ourPkg.dependencies['@primeuix/themes']) {
  fail(`@primeuix/themes pin drift: web-forms built with ${versions.themes}, we pin ${ourPkg.dependencies['@primeuix/themes']}`)
} else ok(`@primeuix/themes pinned to web-forms' ${versions.themes}`)

console.log(failures === 0
  ? `\nBundle parity OK (@getodk/web-forms ${versions.webForms})`
  : `\n${failures} parity failure(s) against @getodk/web-forms ${versions.webForms}`)
process.exit(failures === 0 ? 0 : 1)
