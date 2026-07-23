/**
 * CLI: axe-core accessibility audit of the running app (live or local preview).
 *
 *   pnpm audit:a11y                                 # live Pages deployment, 4 theme×contrast modes, default accent
 *   pnpm audit:a11y --url http://localhost:4173/    # local `pnpm build && pnpm preview`
 *   pnpm audit:a11y --theme dark --contrast high    # one mode; --json out.json for full details
 *   pnpm audit:a11y --accent all --contrast normal  # sweep every accent (accents multiply run time!)
 *
 * Drives the real UI with Playwright (the e2e chromium install), creates a
 * scratch form in the auditor's own throwaway browser profile, and runs the
 * full axe-core WCAG 2.x A/AA ruleset over every reachable surface: library
 * (empty + with a form), new-form gallery, editor (empty + populated with the
 * properties panel open and the preview rendered), each form-menu dialog,
 * export menu, problems popover, help drawer and settings view — once per
 * theme (light/dark) × contrast (normal/high) × accent mode. The accent
 * roster comes straight from src/theme/constants.ts (pure TS module, safe to
 * import under plain node), so `--accent all` can't drift from the app.
 *
 * Lighthouse's accessibility category is axe under the hood but only sees the
 * initial route render; this reaches the stateful surfaces it can't. Overlay
 * states are scoped to the overlay element so page-level findings aren't
 * double-counted. Exits 1 when any violation is found.
 */
import { writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import { chromium } from '@playwright/test'

import { ACCENT_IDS, DEFAULT_ACCENT } from '../src/theme/constants.ts'

const require = createRequire(import.meta.url)
const AXE_PATH = require.resolve('axe-core/axe.min.js')

// Matches STORAGE_KEY/STORAGE_VERSION in src/stores/ui.ts — seeds the theme +
// contrast prefs so each pass renders deterministically instead of following
// the OS (both prefs default to `system`).
const UI_STORAGE_KEY = 'odk-builder:ui:v1'

// PrimeVue popup TieredMenu renders role="menubar", not role="menu" — match by class.
const MENU_SCOPE = '.p-tieredmenu, .p-menu, [role=menu]'
const FORM_MENU_DIALOGS = ['Form settings', 'Translations', 'Choice lists', 'Attachments']

const parseArgs = (argv) => {
  const args = { url: 'https://punkch.github.io/form-forge/', theme: 'both', contrast: 'both', accent: 'default', json: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--') continue // npm-style separator; pnpm forwards it verbatim
    const [flag, inline] = argv[i].split('=')
    const value = inline ?? argv[++i]
    if (flag === '--url') args.url = value
    else if (flag === '--theme') args.theme = value
    else if (flag === '--contrast') args.contrast = value
    else if (flag === '--accent') args.accent = value
    else if (flag === '--json') args.json = value
    else {
      console.error(`Unknown argument: ${flag} (expected --url, --theme light|dark|both, --contrast normal|high|both, --accent <id[,id]>|default|all, --json <path>)`)
      process.exit(2)
    }
  }
  return args
}

/** Inject axe (once per document) and run the WCAG A/AA ruleset. */
const runAxe = async (page, results, label, scope = null) => {
  if (scope) {
    // Overlay states: the overlay must actually be open, else record a skip
    // (a flaked click would otherwise crash the whole run inside axe).
    const present = await page.waitForSelector(scope, { timeout: 3000 }).catch(() => null)
    if (!present) {
      console.log(`  [${label}] SKIPPED — no element matches scope "${scope}"`)
      return
    }
  }
  if (!await page.evaluate(() => Boolean(globalThis.axe))) {
    await page.addScriptTag({ path: AXE_PATH })
  }
  const res = await page.evaluate(async (scope) => {
    return await globalThis.axe.run(scope ? { include: [[scope]] } : document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
      resultTypes: ['violations'],
    })
  }, scope)
  results[label] = res.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    helpUrl: v.helpUrl,
    nodeCount: v.nodes.length,
    nodes: v.nodes.map((n) => ({
      target: String(n.target?.[0] ?? ''),
      html: (n.html ?? '').replace(/\s+/g, ' ').slice(0, 200),
      failure: (n.failureSummary ?? '').replace(/\s+/g, ' ').slice(0, 300),
    })),
  }))
  const brief = res.violations.map((v) => `${v.id}×${v.nodes.length}`).join(', ') || 'clean'
  console.log(`  [${label}] ${brief}`)
}

/** Close whatever overlay is open without touching page state underneath. */
const dismissOverlay = async (page) => {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
}

const auditMode = async (browser, { url, theme, contrast, accent }, results) => {
  const mode = [theme, contrast === 'high' ? 'hc' : null, accent].filter(Boolean).join('-')
  console.log(`— ${mode} —`)
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.setDefaultTimeout(20000)
  await page.addInitScript(([key, prefs]) => {
    localStorage.setItem(key, JSON.stringify(prefs))
  }, [UI_STORAGE_KEY, { version: 1, theme, contrast, accent }])
  const state = (label) => `${mode}:${label}`

  await page.goto(url, { waitUntil: 'networkidle' })
  const applied = await page.evaluate(() => {
    const d = document.documentElement.dataset
    return `${d.ffTheme}/${d.ffContrast ?? 'normal'}/${d.ffAccent}`
  })
  console.log(`  applied theme/contrast/accent: ${applied}`)
  await runAxe(page, results, state('library-empty'))

  // New-form gallery, then create a scratch form through the real UI.
  await page.getByTestId('new-form').click()
  await page.waitForTimeout(400)
  await runAxe(page, results, state('new-form-dialog'), '[role=dialog]')
  await page.getByTestId('new-form-title').fill('A11y audit scratch form')
  await page.getByTestId('new-form-create').click()
  await page.getByTestId('editor').waitFor()
  await page.waitForTimeout(1000)
  await runAxe(page, results, state('editor-empty'))

  // Populate the canvas and open the properties panel on the first node.
  for (const type of ['text', 'select_one', 'image', 'group']) {
    const item = page.getByTestId(`palette-item-${type}`)
    if (await item.count()) await item.first().click()
  }
  await page.locator('.node-card').first().click()
  await page.waitForTimeout(2500) // let the web-forms preview regenerate
  await runAxe(page, results, state('editor-populated'))

  // Every dialog behind the canvas-toolbar gear.
  for (const name of FORM_MENU_DIALOGS) {
    await page.getByTestId('form-menu').click()
    await page.waitForTimeout(300)
    const item = page.locator('[role=menuitem]', { hasText: name }).first()
    if (!await item.count()) {
      console.log(`  [${state(name)}] SKIPPED — menu item not found`)
      await dismissOverlay(page)
      continue
    }
    await item.click()
    await page.waitForTimeout(600)
    await runAxe(page, results, state(`dialog-${name.toLowerCase().replace(/ /g, '-')}`), '[role=dialog]')
    await dismissOverlay(page)
  }

  await page.getByTestId('problems-button').click()
  await page.waitForTimeout(400)
  await runAxe(page, results, state('problems-popover'), '.p-popover')
  await dismissOverlay(page)

  // The export SplitButton's dropdown half is the button right after the primary.
  await page.locator('[data-testid=export-button] .p-splitbutton-dropdown').click()
  await page.waitForTimeout(400)
  await runAxe(page, results, state('export-menu'), MENU_SCOPE)
  await dismissOverlay(page)

  await page.getByTestId('help-button').click()
  await page.waitForTimeout(600)
  await runAxe(page, results, state('help-drawer'), '.p-drawer')
  await dismissOverlay(page)

  await page.goto(`${url}#/settings`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await runAxe(page, results, state('settings-view'))

  await page.goto(`${url}#/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await runAxe(page, results, state('library-with-form'))

  await page.close()
}

const args = parseArgs(process.argv.slice(2))
const themes = args.theme === 'both' ? ['light', 'dark'] : [args.theme]
if (!themes.every((t) => t === 'light' || t === 'dark')) {
  console.error(`Invalid --theme: ${args.theme} (expected light, dark or both)`)
  process.exit(2)
}
const contrasts = args.contrast === 'both' ? ['normal', 'high'] : [args.contrast]
if (!contrasts.every((c) => c === 'normal' || c === 'high')) {
  console.error(`Invalid --contrast: ${args.contrast} (expected normal, high or both)`)
  process.exit(2)
}
const accents = args.accent === 'all' ? [...ACCENT_IDS] : args.accent === 'default' ? [DEFAULT_ACCENT] : args.accent.split(',')
if (!accents.every((a) => ACCENT_IDS.includes(a))) {
  console.error(`Invalid --accent: ${args.accent} (known: ${ACCENT_IDS.join(', ')}, or default/all)`)
  process.exit(2)
}

const modeCount = themes.length * contrasts.length * accents.length
console.log(`Auditing ${args.url} — ${modeCount} mode(s): [${themes}] × [${contrasts}] × [${accents}]`)
const results = {}
const browser = await chromium.launch()
try {
  for (const theme of themes) {
    for (const contrast of contrasts) {
      for (const accent of accents) {
        await auditMode(browser, { url: args.url, theme, contrast, accent }, results)
      }
    }
  }
} finally {
  await browser.close()
}

// Summary: unique findings across states, worst impact first.
const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor']
const unique = new Map()
for (const [state, violations] of Object.entries(results)) {
  for (const v of violations) {
    const entry = unique.get(v.id) ?? { ...v, states: [], total: 0 }
    entry.states.push(`${state}×${v.nodeCount}`)
    entry.total += v.nodeCount
    unique.set(v.id, entry)
  }
}
const sorted = [...unique.values()].sort(
  (a, b) => IMPACT_ORDER.indexOf(a.impact) - IMPACT_ORDER.indexOf(b.impact)
)

console.log('\n=== Unique violations across all audited states ===')
if (!sorted.length) console.log('None — all audited states are clean.')
for (const v of sorted) {
  console.log(`\n${v.id} (${v.impact}) — ${v.help}`)
  console.log(`  ${v.helpUrl}`)
  console.log(`  seen in: ${v.states.join(', ')}`)
  for (const n of v.nodes.slice(0, 3)) {
    console.log(`  - ${n.target}`)
    console.log(`    ${n.failure}`)
  }
  if (v.nodes.length > 3) console.log(`  … ${v.nodes.length - 3} more node(s) — see --json output`)
}

if (args.json) {
  writeFileSync(args.json, JSON.stringify(results, null, 2))
  console.log(`\nFull results written to ${args.json}`)
}

process.exit(sorted.length ? 1 : 0)
