# Standards & conventions — French + Spanish UI localization

Repo invariants from `CLAUDE.md` that constrain this feature, and the
process skills used to deliver it.

## Hard invariants that apply

### UI strings only via vue-i18n

This is the central invariant this feature exists to extend. The new `fr`/
`es` catalogs land under `src/i18n/locales/{fr,es}/` mirroring the 15 `en`
namespace files exactly (same filenames, same single top-level namespace
key per file — `{ "palette": { … } }` — since that shape is what
`@intlify/eslint-plugin-vue-i18n` reads from disk). Each locale's
`index.ts` is typed `... satisfies MessageSchema` (`MessageSchema = typeof
en`, `src/i18n/index.ts:9`) so `vue-tsc` fails at build time on a missing
or extra key in either new locale — completeness is a compile error, not a
runtime surprise. `@intlify/eslint-plugin-vue-i18n`'s `no-missing-keys`
rule is already **error** severity and its `localeDir` pattern
(`src/i18n/locales/*/*.json`, `localeKey: 'path'`) auto-discovers new
locale folders — no eslint config edit is needed for `fr`/`es` to be
linted.

### English catalog stays byte-stable

No content edit to any `src/i18n/locales/en/*.json` file. The only `en.ts`
side-effect anywhere in this feature is registering the *other* two
locales in `createI18n`'s `messages` map and the `SUPPORTED_LOCALES` label
map (`src/i18n/index.ts`) — both additive. Default locale stays `'en'`;
every existing component/e2e test that asserts rendered English keeps
passing unmodified.

### `src/core/` is pure TS — registry/`Issue` strings render verbatim

Not touched, and deliberately not worked around. `src/core/registry/
question-types.ts`'s `title`/`description` fields (question types,
appearances, parameters) and `src/core/validate/issues.ts`'s Issue
`message`s stay English forever, by policy — no Vue/Pinia/Dexie/vue-i18n
import ever lands in `src/core/`. This produces real, accepted
mixed-language surfaces (palette question titles, parameter-row tooltips,
the help drawer's appearance/parameter table cell values, the problems
popover) which `user-guide.md` documents explicitly rather than papering
over. e2e tests that assert `Issue` message substrings are unaffected —
they run against the (unchanged) `en` default and never touch core
strings regardless of locale.

### Preserve `data-testid`s

No new testids are required by this feature — the Settings language
picker's `settings-language-select` testid already exists and is reused
as-is (`src/views/SettingsView.vue`, already asserted by
`tests/e2e/settings.spec.ts:15`). The `/agent-browser` contextual QA pass
and the new e2e assertions navigate by existing testid, never by
translated text (translated text is exactly what's under review).

### No undefined CSS custom properties (stylelint gate)

Relevant only if the QA pass's "fix the layout" posture (Decision 8 in
`shape.md`) requires a CSS change. Any such fix must reference only known
tokens (`--odk-*`, `--builder-*`, `--accent`, or a live `--p-*` computed
from the pinned `@primeuix` emission) — `pnpm lint`'s stylelint pass
(`value-no-unknown-custom-properties`) gates this exactly as it does every
other CSS change in the repo. A fallback-guarded `var(--x, fallback)` is
fine; a new bare `:style`-injected custom property is not expected here
and would need the runtime allowlist in `stylelint.config.mjs` if one ever
were introduced.

### Workspace backup `preferences.json` round-trips the locale unchanged

`locale` is already a plain-string field of `UiPreferences`
(`src/stores/ui.ts`), carried by `exportPreferences`/`applyPreferences` and
the whole-workspace backup's `preferences.json` section
(`WORKSPACE_FORMAT_VERSION` unchanged). This feature adds no new value
shape — `'fr'`/`'es'` are just new valid strings for a field that already
round-trips. No format-version bump. Confirm with a quick addition to
`tests/unit/workspace-full-backup.spec.ts` or `ui.spec.ts` that an `fr`/
`es` value survives `exportPreferences()` → `applyPreferences()` intact
(likely already implied by the existing generic-string handling, but worth
a one-line assertion since this is the first time a non-`en` value is
exercised in anger).

### Conventional commits

Work lands as a conventional commit (e.g. `feat(i18n): add French and
Spanish UI catalogs`), no `Co-Authored-By` trailer or other
self-attribution (global user instruction, overrides any default
guidance).

## Floors / gates not implicated, and one that partly is

- **`pnpm test:coverage` — `stores 80/85` floor is partly implicated.**
  This feature adds one small branch to `src/stores/ui.ts` (the
  `localeWasStored` flag computed from `loadPersisted()`). Both branches
  (a value was stored / none was) must be exercised in `ui.spec.ts` — see
  `plan.md` Task 6 — or the stores branch floor can regress. The rest of
  the store is untouched.
- **`core 86/78/88` floor** — not implicated. `src/i18n/detectLocale.ts`
  and `src/i18n/pluralRules.ts` are new pure modules but live under
  `src/i18n/`, not `src/core/`, so they aren't counted by this floor
  (still get their own unit specs regardless, on correctness grounds, not
  coverage-floor grounds).
- **`persistence 90/92` floor** — not implicated. No Dexie table, no
  `PersistenceBackend` method changes; `ui.locale` lives in `localStorage`
  via the ui store, not through the persistence backend seam.
- **`tests/golden/` (pyxform parity)** — not implicated. No XForm/XLSForm
  serializer or parser change.
- **Both-backend persistence specs** (`tests/helpers/backends.ts`) — not
  implicated. Nothing here touches `src/persistence/`.
- **Embed protocol evolves additively only** — not implicated in the sense
  that nothing changes: `EmbedConfig.locale` (`src/embed/protocol.ts:37`)
  already exists and already accepts any string; the new registered
  locales just make `'fr'`/`'es'` meaningful values for a key that was
  already open-ended. No protocol edit.

## Process skills used

- **Dynamic Workflow, Sonnet implementors** — translation drafting fans
  out one agent per namespace file per locale (15 files × 2 locales = 30
  parallel drafting tasks, per `plan.md` Task 2/3), each given the `en`
  file, a short note on where its strings render (component/section), and
  the glossary — so the agent translates usage, not words. Scaffolding
  (registration, plural rule, first-run detection, tests) is separate,
  sequential work not suited to that fan-out.
- **agent-browser** — the required per-locale contextual QA pass (the
  user's explicit acceptance bar, not optional): switch the UI language,
  walk every major surface, review each string in its rendered context,
  check for layout overflow, screenshot to
  `docs/verification/2026-07-16-ui-localization-fr-es/{fr,es}/`.
- **interface-craft** — used only if the QA pass finds layout overflow
  needing a fix (Decision 8); not required for the catalog/registration
  work, which adds no new visual surface.
- **`/code-review`** (five lenses, no plan mode) on the diff before
  commit; fix findings immediately rather than deferring them.
- **Docs sweep on delivery** — README Features (the "✅ Internationalized
  UI" bullet and the "⬜ More UI languages" Planned bullet), `docs/
  product/roadmap.md`, a `CLAUDE.md` update to the `src/i18n/` code-map row
  and the "UI strings only via vue-i18n" hard-invariant paragraph (both
  currently describe an English-only catalog), and the
  embed-postmessage-api user guide's `locale` example/description.
