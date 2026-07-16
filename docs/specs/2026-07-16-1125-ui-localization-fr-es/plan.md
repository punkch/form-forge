# Plan — French + Spanish UI localization

## Context

The builder's UI chrome ships in English only, even though the i18n
foundation (`docs/specs/2026-07-10-2006-translation-coverage/`) was built
so more locales can be added: a typed per-namespace catalog
(`src/i18n/locales/en/`, 15 files, 1,198 lines), a registration-driven
Settings language picker (`localeOptions()` derives its options from
`i18n.global.availableLocales` — registering a catalog is what adds a
picker entry), a persisted `ui.locale` preference (round-tripped through
the whole-workspace backup's `preferences.json`), and an embed `locale`
config key that already accepts any string. ODK's field reality is heavily
francophone (West/Central Africa) and hispanophone (Latin America); Collect
and Central already ship French and Spanish. This feature ships complete
`fr` and `es` catalogs, wires up first-run language detection, fixes French
pluralization at count 0, and — as the explicit acceptance bar, not an
optional extra — requires a per-locale `/agent-browser` contextual QA pass
before this can be considered done. Full rationale and resolved rulings are
in `shape.md`; repo invariants this must respect are in `standards.md`;
verified file:line detail backing every task below is in `references.md`.

**Binding sequencing constraint:** do not start Task 1 below until the
other five Wave-1 backlog proposals (zip-export-variants,
high-contrast-mode, parameter-help-tooltips, editor-toolbar-declutter,
attachment-manager) have landed on `main`. Each of them changes English
catalog keys that `fr`/`es` must mirror; starting sooner risks translating
content that's about to be renamed, added to, or removed. Before Task 2/3,
re-run `wc -l src/i18n/locales/en/*.json` and diff against the counts in
`references.md` (1,198 lines / 15 files, dated 2026-07-16) to catch
anything those five features changed.

## Resolved decisions (binding — see `shape.md` for full rationale)

1. Eager static catalogs, registered exactly like `en` (no lazy loading).
2. Glossary anchored to ODK Central's and ODK Collect's own shipped
   French/Spanish strings; committed as `glossary.md` in this spec folder.
3. Core registry / `Issue` strings stay English (untouched); the resulting
   mixed-language surfaces are documented in `user-guide.md`.
4. Locale codes stay bare `fr`/`es` (no regional variants).
5. Ship with AI-drafted catalogs gated by mechanical completeness
   (`vue-tsc`/`no-missing-keys`) plus a required per-locale agent-browser
   contextual QA pass and one fix round — no native-speaker gate.
6. First-run locale auto-detection from `navigator.language` against
   registered locales, on the non-embed `main.ts` boot path only, only
   when no locale has ever been stored; Settings/backup-restored
   preferences always win once set.
7. A custom `fr` `pluralRules` entry in `createI18n` (`src/i18n/index.ts`)
   makes 2-form pipe-plural keys render the singular form at count 0;
   3-form keys are already correct and are left alone.
8. Layout overflow found during QA is fixed in CSS/layout by default;
   shortening a translation is the case-by-case fallback.

## Task 1 — Build the ODK-terminology glossary

**What:** a committed glossary anchoring every French/Spanish string this
feature writes to the vocabulary ODK's own tools already use, so a
designer moving between Form Forge and Central/Collect sees one
vocabulary.

**File to create:** `docs/specs/2026-07-16-1125-ui-localization-fr-es/glossary.md`.

**How:**
- Fetch and search `getodk/central-frontend`'s `apps/central/src/locales/
  fr.json` and `es.json` (master branch, e.g. via `gh api` / raw.
  githubusercontent.com) for workspace/publish/submission-domain terms:
  form, draft, publish, submission, attachment, server, entity list,
  preview, configuration. `references.md`'s "ODK ecosystem glossary
  sources" section already has a confirmed starter set (form = Formulaire/
  Formulario, draft = ébauche/borrador, publish = publier/publicar,
  submission = soumission/envío, attachment = fichier joint (or pièce
  jointe)/adjunto, server = serveur/servidor) — extend it, don't
  re-derive it.
- Fetch and search `getodk/collect`'s `strings/src/main/res/values-{fr,
  es}/strings.xml` (master branch) for form-*filling* vocabulary: required,
  choices, constraint, guidance hint. `references.md` already has a
  confirmed starter set (required = obligatoire/obligatorio, choices =
  Choix/Opciones, constraint = contrainte/restricción) — extend it.
- For terms neither source covers (appearance, skip logic/`relevant`,
  choice-list *file*, itemset, workspace, dataset, entity, cascading
  select, calculation, publish target, credential vault) — coin
  consistent translations, preferring the noun forms already confirmed
  above (e.g. "contrainte"/"restricción" for constraint informs
  "restriction de validation" style compounds) and flag each coined term
  inline with `(coined — no direct ODK-ecosystem precedent found)` so a
  later corrections pass can find them quickly.
- Structure: a Markdown table, columns English / Français / Español /
  Source (Central, Collect, or "coined"), covering at minimum: form,
  draft, submission, publish, publish target, choice list, choice, choice
  filter, question, appearance, required, relevant, constraint,
  calculation, hint, guidance hint, default value, attachment, workspace,
  server, credential/vault, dataset, entity, entity list, template,
  cascading select, itemset, group, repeat, translation/language,
  validation, warning/error, preview.
- Note explicitly at the top of the file: this glossary is a starting
  point for translation drafting (Tasks 2/3), not a locked spec — where a
  specific rendered-context need in a namespace file conflicts with a
  glossary entry, the translator notes the deviation in that namespace's
  drafting notes rather than silently diverging.

**Tests:** none (a reference document).

## Task 2 — French catalog: all 15 namespace files + `index.ts`

**What:** `src/i18n/locales/fr/` — one JSON file per `en` namespace file
plus a typed `index.ts`.

**Files to create:**
- `src/i18n/locales/fr/{appSettings,canvas,central,common,dialogs,guides,
  help,importExport,library,palette,preview,properties,settings,shell,
  stores}.json` — one per corresponding `en` file, same top-level
  namespace key, same nested key structure, translated values.
- `src/i18n/locales/fr/index.ts` — mirrors `src/i18n/locales/en/index.ts`
  structure exactly (same import list, same spread order, same
  doc-comment adapted for French), typed:
  ```ts
  import type { MessageSchema } from '@/i18n'
  // … same 15 namespace imports as en/index.ts, from './*.json' …
  export const fr = { ...common, ...shell, /* … same order as en … */ } satisfies MessageSchema
  ```
  `import type { MessageSchema } from '@/i18n'` is safe even though
  `src/i18n/index.ts` will (after Task 4) import `fr` from this same
  file: it's a **type-only** import, fully erased at compile time, so it
  creates no runtime module cycle (unlike a value import would). This is
  the same pattern `src/i18n/schema.d.ts` already uses to import
  `MessageSchema` back from `./index` for the global `vue-i18n` type
  augmentation — confirmed no existing build issue from that direction
  today.

**How (fan-out):** one agent per namespace file (15 parallel drafting
tasks for this locale), each given: the `en` namespace file verbatim, the
glossary (Task 1), and a short "where this renders" note (below) so
translation targets usage, not words. Interpolation placeholders
(`{count}`, `{names}`, `{filename}`, `{title}`, …), the `·` separator
characters, and every pipe-plural's form count must survive exactly
(same number of `|`-separated forms as the `en` source — do not add or
drop a form; Task 5 handles the *behaviour* at count 0, not the *shape* of
each string).

Where-it-renders notes for the fan-out briefing:
- `common` — shared buttons/labels/counts used across every surface.
- `shell` — app header/nav, embed waiting/error states.
- `library` — form library view: cards, new-form dialog, template
  gallery, empty state.
- `palette` — the question-type palette's own chrome (search, group
  labels; **not** `def.title`/`def.description`, which are core registry
  English — see `standards.md`).
- `canvas` — the editor canvas: question cards, drag/drop hints, empty
  state.
- `properties` — every property-panel section for every question kind.
- `preview` — the live-preview pane and its device-size presets.
- `dialogs` — generic confirmation/prompt dialogs used app-wide.
- `help` — the help drawer's own written content: question-type
  `whatItDoes`/`xlsformNotes` prose, field help, table column headers
  (**not** the appearance/parameter table's cell values, which stay
  English — see `standards.md`).
- `guides` — the workflow guides' full text (title/summary/steps) plus
  first-use callouts.
- `importExport` — export menu, import dialog, conflict resolution,
  summaries.
- `settings` — **not** the app-level Settings page (that's
  `appSettings`, next) — this is the **per-form** "Form settings" dialog
  (`src/components/settings/FormSettingsDialog.vue`): title/ID/version/
  instance name/style/submission URL/public key, and the Entities tab
  (dataset declaration, `create_if`/`update_if`/`entity_id`, saved
  properties, follow-up-form wizard).
- `appSettings` — the app-level Settings page: workspace export/import,
  language picker section, appearance, About.
- `stores` — small, cross-cutting strings owned by Pinia stores rather
  than a component.
- `central` — every Central surface: server pickers, the publish drawer,
  destination rows, publish-flow status, vault unlock, the library import
  drawer, CentralServersSection.

**Tests:** none directly (content only) — completeness is gated
mechanically by Task 4's registration + `vue-tsc`/`no-missing-keys`.

## Task 3 — Spanish catalog: all 15 namespace files + `index.ts`

Identical in shape and process to Task 2, for `src/i18n/locales/es/`,
producing `src/i18n/locales/es/{...same 15 files...}.json` and
`src/i18n/locales/es/index.ts` (`export const es = { ... } satisfies
MessageSchema`). Run its 15-way fan-out in parallel with Task 2's — the
two locales don't share drafting state, only the glossary (Task 1) and
the same where-it-renders notes above.

## Task 4 — Registration wiring

**What:** make the two new catalogs live: register them in `createI18n`,
label them in the picker map.

**File to modify:** `src/i18n/index.ts`.
- Import `fr` and `es` (`import { fr } from './locales/fr'`, `import {
  es } from './locales/es'`), alongside the existing `import { en } from
  './locales/en'`.
- `messages: { en, fr, es }` in the `createI18n` call (`:37-43`).
- `SUPPORTED_LOCALES` gains `fr: 'Français'`, `es: 'Español'` (`:52`).
- Add the `pluralRules` entry here too (see Task 5) so this is the single
  commit that finishes wiring `createI18n`.
- No other file needs an edit for the Settings picker to show the two new
  options — `localeOptions()` (`:55-56`) is registration-driven; confirm
  this by re-reading `references.md`'s note before touching
  `SettingsView.vue` (it should need **no** change).

**Tests:**
- No new unit test is strictly required for this wiring alone (it's
  exercised end-to-end by Task 7's e2e cases), but if `src/i18n/index.spec.ts`
  does not yet exist, do not create one solely for this — rely on the e2e
  coverage plus the existing component/e2e suites that already assert
  `settings-language-select` contains `'English'` (unaffected, since `en`
  stays first/default) to catch a registration regression.

## Task 5 — French pluralization rule

**What:** a custom `fr` pluralization rule so 2-form pipe-plural keys
render the singular form at count 0 (`"0 erreur"`, not `"0 erreurs"`),
without disturbing 3-form keys (already correct under vue-i18n's default
rule) or any other locale.

**File to create:** `src/i18n/pluralRules.ts`:
```ts
import type { PluralizationRule } from 'vue-i18n'

/**
 * French treats a zero count as grammatically singular ("0 erreur", not
 * "0 erreurs"), unlike vue-i18n's default rule, which maps a 2-form
 * message's count 0 to the plural form (correct for English: "0
 * errors"). This only overrides that one case — a 2-form message
 * (`choicesLength === 2`) at `choice === 0` — and defers to the built-in
 * rule (`orgRule`) for every other count and every other message shape,
 * so 3-form messages (which already carry a distinct zero-count wording
 * under the default rule, e.g. "no forms found. | 1 form found. | …")
 * are untouched.
 */
export const frPluralRule: PluralizationRule = (choice, choicesLength, orgRule) => {
  if (choicesLength === 2 && choice === 0) return 0
  return orgRule ? orgRule(choice, choicesLength) : choice === 1 ? 0 : 1
}
```

**File to modify:** `src/i18n/index.ts` — add `pluralRules: { fr:
frPluralRule }` to the `createI18n` call, importing `frPluralRule` from
`./pluralRules`.

**Test to create:** `src/i18n/pluralRules.spec.ts` (co-located, first spec
file in `src/i18n/` — there is no existing precedent to match, keep it a
plain `vitest` unit spec, no component/DOM needed):
- `frPluralRule(0, 2, undefined)` → `0` (singular index).
- `frPluralRule(1, 2, undefined)` → `0` (unchanged from default: 1 is
  singular).
- `frPluralRule(5, 2, undefined)` → `1` (unchanged: plural).
- `frPluralRule(0, 3, (c, n) => (c === 0 ? 0 : c === 1 ? 1 : 2))` → `0`
  (defers to `orgRule`, unaffected by the fr override).
- An integration-style assertion using the real `i18n` instance (import
  `i18n` from `@/i18n`, `i18n.global.locale.value = 'fr'`, then `i18n.
  global.t('common.errorCount', 0)` — pick one real 2-form key from the
  audited list below) equals the fr catalog's singular form, not the
  plural — this is the check that actually proves the wiring in Task 4
  and the rule in this task compose correctly, not just that the pure
  function returns the right index in isolation.

**Audited plural-key list (confirmed 2-form — need the fr fix; do not
re-derive, verify unchanged against current `en` files first per
Sequencing):** `common.errorCount`, `common.warningCount`,
`library.questionCount`, `properties.sharedWarning`,
`properties.choiceCount`, `properties.usedByCount`,
`properties.deleteWarning`, `importExport.summaryUntranslated`,
`importExport.importButtonCount`, `importExport.importedDetail`.

**Confirmed 3-form (already correct, do not touch):**
`importExport.summaryReady`, `importExport.formsFound`,
`importExport.attachmentCount`, `importExport.serverCount`,
`importExport.targetCount`, `central.attachmentsPulled`.

If Wave-1 features (per Sequencing) added any *new* pipe-plural keys,
audit each one the same way (count the `|`-separated forms; 2-form needs
the fr-zero check, 3-form doesn't) before finishing this task.

## Task 6 — First-run locale auto-detection

**What:** on first-ever load (no locale preference stored, non-embed
only), match `navigator.language` against the app's registered locales and
apply the closest one; a subsequent explicit choice (Settings, or a
restored workspace-backup preference) always wins from then on.

**File to create:** `src/i18n/detectLocale.ts`:
```ts
/**
 * Best-matches a browser/OS language tag (`navigator.language`, e.g.
 * 'fr-CA') against the app's registered UI locales. Tries an exact match
 * first, then the primary subtag (`fr-CA` → `fr`), case-insensitively;
 * falls back to `fallback` when nothing matches. Pure and side-effect
 * free so it's unit-testable without touching i18n/DOM state.
 */
export const detectPreferredLocale = (
  browserTag: string,
  availableLocales: readonly string[],
  fallback: string
): string => {
  const normalized = browserTag.toLowerCase()
  const exact = availableLocales.find((code) => code.toLowerCase() === normalized)
  if (exact) return exact
  const primary = normalized.split('-')[0]
  const bySubtag = availableLocales.find((code) => code.toLowerCase() === primary)
  return bySubtag ?? fallback
}
```

**File to modify:** `src/stores/ui.ts` — add, immediately after the
existing `const locale = ref(...)` line (`:105`):
```ts
/**
 * True when a locale preference was already persisted (as opposed to
 * defaulting to 'en' because none was ever stored). Read once at boot by
 * main.ts to decide whether first-run locale auto-detection should run —
 * kept out of the persisted-watch list below since it's a boot-time fact,
 * not a live preference.
 */
const localeWasStored = typeof persisted.locale === 'string' && persisted.locale !== ''
```
Add `localeWasStored,` to the store's returned object (`:229-250`,
alongside `locale` at `:236`) — read-only from the outside, no setter.

**File to modify:** `src/main.ts` — immediately before the existing
`setLocale(useUiStore(pinia).locale)` line (`:77`), guarded to the
non-embed path only:
```ts
const ui = useUiStore(pinia)
if (!embed.active && !ui.localeWasStored) {
  const detected = detectPreferredLocale(navigator.language, i18n.global.availableLocales, ui.locale)
  if (detected !== ui.locale) ui.locale = detected
}
setLocale(ui.locale)
```
(Replace the existing inline `useUiStore(pinia).locale` call with the new
`ui` binding; import `detectPreferredLocale` from `@/i18n/detectLocale`.)
Note `embed` (from `embedDetection()`, `:37`) and `i18n` (`:23`) are
already in scope at this point in the file.

**Tests to create/update:**
- `src/i18n/detectLocale.spec.ts` (co-located, plain vitest unit spec):
  exact match (`'fr'` against `['en', 'fr', 'es']` → `'fr'`),
  primary-subtag match (`'fr-CA'` → `'fr'`, `'es-MX'` → `'es'`), no match
  falls back (`'de'` → the passed `fallback`), case-insensitivity
  (`'FR-ca'` → `'fr'`), empty/malformed input falls back gracefully
  (`''` → `fallback`, no throw).
- `src/stores/ui.spec.ts` — extend the existing `describe('ui store locale
  persistence', …)` block (`:12`) with `localeWasStored` assertions for
  its four existing scenarios: `true` when a non-empty `locale` was
  stored (mirrors the existing "restores a persisted locale" case,
  `:32-36`), `false` when nothing was ever stored (mirrors `:38-40`),
  `false` when the stored `locale` is `''` (mirrors `:43-47`), and `false`
  when the stored blob's `version` doesn't match `STORAGE_VERSION` (a new
  scenario — seed `{ version: 2, locale: 'fr' }` against the current
  `STORAGE_VERSION` of `1` and confirm `loadPersisted()` discards the
  whole blob, so `localeWasStored` is `false`).
- No dedicated `main.ts` unit test (none exists for boot-sequence code
  today, per `references.md`) — the first-run behaviour is instead
  covered end-to-end by Task 7's Playwright case, which is the only way to
  control `navigator.language` realistically.

## Task 7 — e2e coverage

**What:** two additions to `tests/e2e/settings.spec.ts` (the file that
already asserts the language picker defaults to English at `:15`) — a
manual-switch-and-persistence smoke test, and a first-run-detection test.
Default-locale suites elsewhere in `tests/e2e/` are untouched.

**File to modify:** `tests/e2e/settings.spec.ts`.

Add, inside the existing `test.describe('app settings', …)` block:
```ts
test.describe('language switching', () => {
  test('switches to French, persists a known shell string, survives reload', async ({ page }) => {
    // Node-side import of the shipped fr catalog — assert against the
    // real translated string rather than hardcoding a guess at it.
    const { fr } = await import('@/i18n/locales/fr')

    await page.goto('/#/')
    await page.getByTestId('settings-gear').click()
    await page.getByTestId('settings-language-select').click()
    await page.getByRole('option', { name: 'Français', exact: true }).click()

    // Pick one always-visible, uniquely-identifying shell/appSettings
    // string (e.g. the Settings page heading) and assert the rendered
    // text equals the catalog's own French value.
    await expect(page.getByTestId('settings-view').locator('h1'))
      .toHaveText(fr.appSettings.title)

    await page.reload()
    await expect(page.getByTestId('settings-language-select')).toContainText('Français')
    await expect(page.getByTestId('settings-view').locator('h1'))
      .toHaveText(fr.appSettings.title)
  })
})

test.describe('first-run locale detection', () => {
  test.use({ locale: 'fr-CA' })

  test('a fresh session with no stored preference matches navigator.language to fr', async ({ page }) => {
    await page.goto('/#/')
    await page.getByTestId('settings-gear').click()
    await expect(page.getByTestId('settings-language-select')).toContainText('Français')
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  })
})
```
Adjust the exact selector for the Settings heading / picked string to
whatever `appSettings.json`'s actual key is (confirm via Task 2's drafted
file — `appSettings.title` is the expected key based on the current `en`
catalog's `t('appSettings.title')` usage in `SettingsView.vue`, but
re-check once Wave-1 features may have touched that namespace). The
`test.use({ locale: 'fr-CA' })` scoped to the inner `describe` sets
Playwright's browser-context locale (hence `navigator.language`) only for
that block, leaving every other test's default English context alone.

**Tests:** this task *is* the test addition; no further spec changes.

## Task 8 — Contextual QA pass: French

**What:** the required acceptance gate. Drive the **built** app
(`pnpm build && pnpm preview`, matching how `/agent-browser` and e2e both
exercise the app) with the `/agent-browser` skill, UI language switched to
French, and walk every surface listed in `user-guide.md`'s "Manual test
scenarios" (library, editor + every property-panel section, palette,
choices/translations/attachments, import/export, Central drawers + vault
unlock, settings, help drawer + guides, problems popover, toasts).

For each surface, judge every string **in its rendered context**: does it
describe what the control does, not just a literal word-for-word swap?
Note any layout overflow, truncation, or broken alignment — French strings
run longest of the three locales and are most likely to expose a layout
gap.

**Output:** screenshots + a findings note under
`docs/verification/2026-07-16-ui-localization-fr-es/fr/` (numbered PNGs +
a `README.md` summarizing what was checked and what was found, matching
the pattern in `docs/verification/2026-07-15-central-ux/`).

**Tests:** none directly — this task produces the findings that Task 10
fixes.

## Task 9 — Contextual QA pass: Spanish

Identical in method and scope to Task 8, for Spanish, output to
`docs/verification/2026-07-16-ui-localization-fr-es/es/`.

## Task 10 — Fix round

**What:** address every finding from Tasks 8 and 9.
- **Translation-accuracy findings** — correct the specific catalog string
  (`fr`/`es` namespace JSON file), re-verify in context.
- **Layout-overflow findings** — fix the layout by default (Decision 8):
  adjust CSS (respecting the stylelint undefined-custom-property gate,
  `standards.md`) or component markup (more generous wrapping/min-width,
  truncation with a tooltip) so the fix serves *any* long string, not just
  the specific French wording found. Only shorten the translation itself
  when a structural layout fix genuinely isn't reasonable (e.g. a
  fixed-width badge used everywhere), and note why in the commit/PR
  description.
- Load `/interface-craft` for any layout fix that changes visual rhythm
  (spacing, wrapping behaviour) beyond a one-line CSS tweak, per
  `standards.md`'s process-skills note.
- Re-run the specific `/agent-browser` scenario(s) that surfaced each
  finding to confirm the fix, and append the confirmation to the same
  `docs/verification/.../{fr,es}/README.md` findings log (don't overwrite
  the original finding — show finding → fix → confirmed).

**Tests:** if a layout fix touches a component with existing component
tests (e.g. a `*.spec.ts` under `tests/component/`), re-run that file to
confirm no regression; no new tests are expected purely from copy fixes.

## Task 11 — Docs sweep

**What:** update project docs to reflect two new shipped UI languages.
- `README.md`: the "✅ Internationalized UI" bullet (currently "English
  today, translation-ready…") — reword to name French and Spanish as
  shipped, keep the translation-ready framing for future locales. The
  "⬜ More UI languages — French, Spanish, Arabic (RTL), Russian…" Planned
  bullet — remove French/Spanish from that list (they're delivered now),
  keep Arabic/Russian as still-planned.
- `docs/product/roadmap.md`: the "UI internationalization" Delivered bullet
  (currently describes the English-only foundation) — extend to mention
  French/Spanish now shipping; add a short new bullet or extend the
  existing one under the appropriate delivered-work section (follow the
  existing terse, past-tense style of neighbouring bullets).
- `CLAUDE.md`: the `src/i18n/` code-map row — extend to mention
  `pluralRules.ts` (custom `fr` zero-plural rule) and `detectLocale.ts`
  (first-run auto-detection), and that `locales/{en,fr,es}/` now all
  exist. The "UI strings only via vue-i18n" hard-invariant paragraph —
  confirm it still reads accurately (it already states the typed-catalog/
  `no-missing-keys` mechanism generically; add a clause noting three
  locales are now registered if the current wording implies English-only).
- `docs/specs/2026-07-09-2235-embed-postmessage-api/user-guide.md`: the
  `locale` config description/example (`:75,91`) — note that `'fr'`/`'es'`
  are now meaningful values (no protocol change, just an example update).
- `docs/specs/backlog/README.md`: move this entry from "Pending proposals"
  to "Delivered (kept here as provenance)", matching the existing pattern
  for other delivered entries, pointing at this spec folder.

**Tests:** none (docs only).

## Verification

Commands (run from repo root):
```bash
pnpm lint                 # eslint (incl. no-missing-keys over locales/*/*.json) + stylelint
pnpm typecheck            # vue-tsc — fails on any fr/es key missing/extra vs MessageSchema
pnpm test                 # unit (incl. pluralRules.spec.ts, detectLocale.spec.ts, ui.spec.ts additions) + component
pnpm test:coverage        # confirm the stores floor (80/85) still holds with the new ui.ts branch covered
pnpm build && pnpm preview  # build the app the way /agent-browser and e2e both exercise it
pnpm test:e2e             # full suite, incl. the two new settings.spec.ts cases; confirm no default-locale suite regressed
```

Manual/agent verification:
- `/agent-browser` contextual QA pass, French (Task 8) — screenshots +
  findings to `docs/verification/2026-07-16-ui-localization-fr-es/fr/`.
- `/agent-browser` contextual QA pass, Spanish (Task 9) — screenshots +
  findings to `docs/verification/2026-07-16-ui-localization-fr-es/es/`.
- `/interface-craft` critique for any layout fix from Task 10 that's more
  than a one-line CSS tweak.
- Re-verify both locales' fixed scenarios after Task 10 and append
  confirmation to the same verification logs.
- `/code-review` (five lenses, no plan mode) on the full diff before
  commit; fix findings immediately, don't defer.

Once all of the above is green and the fix round is confirmed, land as a
single conventional commit (e.g. `feat(i18n): add French and Spanish UI
catalogs`, no `Co-Authored-By` trailer), then apply Task 11's docs sweep.
