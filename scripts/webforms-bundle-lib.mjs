/**
 * Shared extraction helpers for the @getodk/web-forms bundle. Used by both
 * scripts/verify-webforms-bundle.mjs (CLI) and tests/unit/theme-parity.spec.ts
 * to detect drift between the bundled ODK design system and our copies in
 * src/styles/odk-tokens.css + src/styles/odk-preset.ts.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

export const findWebFormsDist = () => {
  // './package.json' is not an exported subpath — resolve via the main entry
  // (…/dist/index.js) and walk up to the package root.
  const entry = require.resolve('@getodk/web-forms')
  const dir = dirname(entry)
  const pkgPath = join(dirname(dir), 'package.json')
  return { dir, pkg: JSON.parse(readFileSync(pkgPath, 'utf8')) }
}

/** Reads dist/index.js plus sibling chunks, concatenated. */
export const readBundleSources = () => {
  const { dir } = findWebFormsDist()
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n')
}

/** Extracts the (deduplicated) --odk-* token map from :root blocks. */
export const extractOdkTokens = (source) => {
  const tokens = new Map()
  const blockRe = /:root\s*\{([^}]*--odk-[^}]*)\}/g
  let match
  while ((match = blockRe.exec(source)) !== null) {
    for (const decl of match[1].split(';')) {
      const idx = decl.indexOf(':')
      if (idx === -1) continue
      const name = decl.slice(0, idx).trim()
      const value = decl.slice(idx + 1).trim()
      if (name.startsWith('--odk-')) tokens.set(name, value)
    }
  }
  return tokens
}

/** Extracts the ODK primary color scale (50..950) around the #3e9fcc anchor. */
export const extractPrimaryScale = (source) => {
  const anchor = source.indexOf('#3e9fcc')
  if (anchor === -1) return null
  const window = source.slice(Math.max(0, anchor - 800), anchor + 800)
  const scale = {}
  const re = /(\d{2,3}):\s*"(#[0-9a-fA-F]{6})"/g
  let match
  while ((match = re.exec(window)) !== null) {
    scale[match[1]] = match[2].toLowerCase()
  }
  return scale
}

/** PrimeVue-stack versions web-forms was built against (published devDeps). */
export const bundledPrimeVueVersions = () => {
  const { pkg } = findWebFormsDist()
  return {
    primevue: pkg.devDependencies?.primevue,
    themes: pkg.devDependencies?.['@primeuix/themes'],
    primeflex: pkg.devDependencies?.primeflex,
    webForms: pkg.version,
  }
}

/** Parses the --odk-* declarations out of our src/styles/odk-tokens.css. */
export const parseTokensCss = (cssText) => {
  const tokens = new Map()
  for (const line of cssText.split('\n')) {
    const match = line.match(/^\s*(--odk-[a-z0-9-]+):\s*(.+?);\s*$/i)
    if (match !== null) tokens.set(match[1], match[2].trim())
  }
  return tokens
}
