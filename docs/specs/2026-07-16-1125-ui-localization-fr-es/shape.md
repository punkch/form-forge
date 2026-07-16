<!--
  Shape spec (promoted from docs/specs/backlog/ui-localization-fr-es.md,
  2026-07-16). Open questions resolved with the user 2026-07-16.
-->

# French + Spanish UI localization — shape

**Status:** ready for implementation · **Effort:** M (~3–4 days) ·
**Depends on:** the delivered i18n foundation
(`docs/specs/2026-07-10-2006-translation-coverage/`) — typed per-namespace
catalog, registration-driven Settings language picker, persisted
`ui.locale`, embed `locale` config key — **and, strictly, on the other five
Wave-1 backlog proposals landing on `main` first** (see Sequencing).

## Problem

The builder's UI chrome ships in English only, while the i18n infrastructure
was built precisely so more locales can be added: a typed per-namespace
catalog, a registration-driven language picker, a persisted preference, and
an embed config key. ODK's field reality is heavily francophone (West/
Central Africa) and hispanophone (Latin America) — enumerator-facing
tooling in the ODK ecosystem (Collect, Central) already ships French and
Spanish. Form designers working in those languages get an English-only
builder today.

The feature: ship complete **French (`fr`)** and **Spanish (`es`)** UI
catalogs, selectable in Settings → UI language (and via the embed `locale`
config), with a **contextual quality pass** as a first-class delivery
stage — translations must describe what each control actually does in its
on-screen context, verified by driving the running app with the
`/agent-browser` skill, not merely be word-for-word correct.

## Scope

- Complete `fr` and `es` catalogs: `src/i18n/locales/{fr,es}/` mirroring
  the 15 en namespace files byte-for-byte in shape (same top-level
  namespace keys, same nesting), an `index.ts` per locale typed
  `satisfies MessageSchema`, both registered in `createI18n`'s `messages`;
  `SUPPORTED_LOCALES` gains `fr: 'Français'`, `es: 'Español'`.
- **Terminology alignment with the ODK ecosystem** via a small glossary,
  anchored to ODK's own shipped French/Spanish translations (Central's
  admin frontend, Collect's Android app), so designers moving between Form
  Forge and Central/Collect see one vocabulary. Built first; every catalog
  string conforms to it.
- Plural-rule audit: every pipe-plural key in the English catalog is
  checked for correct French/Spanish rendering at every count that can
  occur, **including 0**. A custom `fr` `pluralRules` entry is added to
  `createI18n` (not `setLocale`) so a 2-form key renders its singular form
  at count 0 (`"0 erreur"`, not `"0 erreurs"`) — see Decisions. 3-form keys
  already carry a distinct zero-count wording and need no rule change.
  Interpolation placeholders (`{count}`, `{names}`, `{filename}`, …) and `·`
  separators survive translation byte-exact.
- **Contextual QA pass (required — the acceptance bar for this feature)**:
  once catalogs exist, drive the **built app** with `/agent-browser` once
  per locale — switch the UI language, walk every major surface (library,
  editor with all property-panel sections, palette, choices/translations/
  attachments panels, import/export menus + dialogs, Central drawers +
  vault unlock, settings, help drawer + guides, problems popover, toasts
  where triggerable) — and review each string **in its rendered context**:
  does it describe what the control does (not a literal word swap)? Do
  longer strings overflow, truncate, or break layouts? Screenshot the pass
  to `docs/verification/`; findings feed one fix round before commit.
- An e2e smoke test: switch language in Settings, assert a known shell
  string renders in French, reload, assert persistence; a separate e2e
  case for first-run locale auto-detection (see Decisions). Default-locale
  suites (the overwhelming majority of `tests/e2e/`) stay untouched — they
  keep asserting rendered English against the `en` default.
- Docs sweep on delivery: README Features, `docs/product/roadmap.md`,
  `CLAUDE.md` (the `src/i18n/` code-map row and the "UI strings only via
  vue-i18n" invariant), the embed-postmessage-api user guide's `locale`
  example.

**Out of scope:** localizing core registry strings / `Issue` messages
(policy stands — src/core/ purity; see Decisions on the resulting
mixed-language surfaces), RTL locales (the `dir` hook exists; Arabic would
be its own effort), localizing bundled starter templates or help
`docsUrl`/`docsAnchor` targets (docs.getodk.org language availability
varies and is a separate concern from the catalog), translating *form
content* (the TranslationsDialog feature translates the forms being built —
unrelated to the builder's own UI language), and a community-translation
pipeline (Weblate/Transifex — corrections are invited via GitHub issues
instead, see Decisions).

## Decisions

All four backlog "proposed decisions" are **adopted**, and every former
"open question" is **resolved**, as follows:

1. **Eager static catalogs**, registered exactly like `en` (static imports
   in `createI18n`'s `messages`), over lazy per-locale chunks. ~40 KB raw
   per locale is gzip-trivial and the offline PWA precaches everything
   anyway; lazy loading would add moving parts (async `setLocaleMessage`,
   loading state in the picker) for no user-visible win at two extra
   locales. `localeOptions()`'s registration-driven contract
   (`i18n.global.availableLocales`) is unchanged.
2. **Glossary anchored to ODK's own fr/es translations.** Sourced from
   ODK Central's admin frontend (`getodk/central-frontend`,
   `apps/central/src/locales/{fr,es}.json`) for workspace/publish/
   submission-domain vocabulary, and ODK Collect's Android app
   (`getodk/collect`, `strings/src/main/res/values-{fr,es}/strings.xml`)
   for form-filling vocabulary (required, choices, constraint, guidance
   hint) — both fetched and spot-checked 2026-07-16 (see `glossary.md`'s
   provenance section once drafted, and `references.md` for the terms
   already confirmed). Committed as `glossary.md` **in this spec folder**
   (not the backlog) so it's available to future locale work. Fresh
   coinage only where the ecosystem has no equivalent term (e.g. this
   app's own concepts like "choice list *file*" for `select_one_from_file`
   vs. Collect's plain "choices").
3. **Registry/`Issue` English stays.** `src/core/` purity is not
   negotiable, and Issue messages are e2e-pinned. The user accepts the
   resulting mixed-language surfaces: the palette's question-type title/
   tooltip, the properties panel's type-picker header and parameter-row
   tooltips, the help drawer's appearance/parameter table **cell values**
   (headers translate; `appearance.description`/`param.description` do
   not), and the problems popover's issue messages all render registry/
   core English regardless of the active UI locale. Documented explicitly
   in `user-guide.md` rather than half-localizing core. This is a narrower
   set of surfaces than the backlog doc's "help drawer tables" phrasing
   suggested — the help drawer's own prose (`help.json`'s `whatItDoes`/
   `xlsformNotes`, `guides.json`'s guide steps/summaries) **is** a normal
   catalog namespace and **is** translated; only the registry-sourced table
   *cells* stay English. See `references.md` for the exact file:line
   corrections.
4. **Locale codes stay bare `fr`/`es`** (no regional variants) — matches
   the embed protocol's BCP-47 `locale` key (already a plain string, no
   change needed) and keeps the Settings picker short. Regional variants
   (`es-419`, `fr-CA`, …) are deferred to user feedback.
5. **QA bar: ship with AI-drafted catalogs.** The acceptance gate is
   mechanical completeness (`vue-tsc` via `satisfies MessageSchema` +
   `no-missing-keys`) **plus** the required per-locale `/agent-browser`
   contextual pass with one fix round — not a native-speaker review gate.
   Corrections after ship are invited via GitHub issues; the catalog files
   are trivially patchable JSON.
6. **First-run locale auto-detection.** When **no locale preference has
   ever been stored** (a brand-new install, or an existing install from
   before this feature — both look identical: `ui.locale` currently
   defaults silently to `'en'`), the boot path matches `navigator.language`
   against the app's *registered* locales and applies the best match
   (`fr-CA` → `fr`, exact match preferred over primary-subtag match,
   falling back to `en` when nothing matches). This is a one-time
   auto-selection, not a live "your OS changed language" tracker. The
   **Settings picker and a restored workspace-backup preference always
   win** once a locale has been explicitly set (backup restore already
   calls `ui.applyPreferences` + `setLocale`, unaffected). Implemented on
   the **non-embed `main.ts` boot path only** — an embed host always
   passes its `locale` explicitly via `EmbedConfig` (already required
   today; nothing to detect), so `src/stores/embed.ts`'s `applyConfig` is
   unchanged.
7. **French plurals.** Every pipe-plural key was audited (see Scope and
   `references.md` for the full key list with file:line). **2-form keys**
   (singular/plural only) render the plural form at count 0 under
   vue-i18n's default rule — correct for English ("0 errors") but wrong
   for French ("0 erreur", not "0 erreurs"). A custom `fr` entry in
   `createI18n`'s `pluralRules` option (`src/i18n/index.ts` — **not**
   `setLocale.ts`, which only ever set `locale`/`lang`/`dir`) maps count 0
   to the singular index **only when the message has exactly two forms**,
   deferring to the default rule otherwise. **3-form keys** (zero/singular/
   plural, e.g. `"no forms found. | 1 form found. | {count} forms
   found."`) already get index 0 at count 0 under vue-i18n's *default*
   rule and need no change — their zero-count wording is already distinct
   in English and will be equally distinct once translated.
8. **Layout overflow posture: fix the layout by default.** Where a longer
   French (typically the longer of the two new locales) string overflows,
   truncates, or breaks a layout during the QA pass, the default response
   is a CSS/layout fix (more generous wrapping, `min-width` easing, text
   truncation with a tooltip, etc.) — not shortening the translation to
   fit. Shortening a translation is the fallback, decided case-by-case,
   only when a layout fix isn't reasonable (e.g. a fixed-width badge that
   exists everywhere and can't grow).

## Sequencing (binding)

This feature must not start implementation until the other five Wave-1
backlog proposals have landed on `main`: **zip-export-variants**,
**high-contrast-mode**, **parameter-help-tooltips**,
**editor-toolbar-declutter**, and **attachment-manager**. Every one of them
adds, renames, or removes English catalog keys; starting translation work
before they land would mean re-doing namespace files mid-flight or shipping
an `fr`/`es` catalog that immediately falls out of sync with `en` (and
fails `vue-tsc`/`no-missing-keys` the moment those features merge). Once
all five are in, re-diff `src/i18n/locales/en/` against the state this
promotion was written against (2026-07-16) before starting Task 2/3 in
`plan.md`, and fold any new/changed keys into the namespace-by-namespace
translation fan-out.

## Context

Promoted 2026-07-16 from `docs/specs/backlog/ui-localization-fr-es.md`;
open questions resolved with the user 2026-07-16; the backlog doc's
"current implementation" notes were verified against code the same day —
corrected in `references.md` (exact file counts/line numbers, the
registration-driven Settings picker mechanics, and, notably, the narrower-
than-stated scope of the "mixed-language surfaces" the registry/Issue
policy actually produces).

## Skills & conventions applied

- **Delivery process** (CLAUDE.md) — shape (backlog) → promoted timestamped
  spec folder (this one) → implementation via a dynamic Workflow (fan-out
  one implementor per namespace file per locale for translation drafting,
  per Sequencing/plan.md) → verification → `/code-review` (five lenses, no
  plan mode) → conventional commit → docs sweep.
- **agent-browser** — the required per-locale contextual QA pass (not
  optional, the user's explicit acceptance bar), logged with screenshots to
  `docs/verification/2026-07-16-ui-localization-fr-es/{fr,es}/`.
- **interface-craft** — used during the QA fix round for any layout
  overflow found, per the "fix the layout by default" posture; not needed
  for the catalog/registration work itself (no new visual surface).
- **`/code-review`** on the diff before commit; fix findings immediately.
- **Conventional commits**, no `Co-Authored-By` trailer (global user
  instruction, overrides any default guidance to append one).
