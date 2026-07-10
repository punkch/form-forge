# In-app guidance for workflow features — Shaping Notes

## Scope

The existing in-app help covers *things* (question types, property fields) but
not *workflows*. This feature adds a third help category — **workflow guides** —
that explains multi-step, cross-panel features whose value is invisible unless
you already know them: translations, the visual logic builder, external
datasets, entities + follow-up wizard, workspace backup, templates, autosave &
crash snapshots, and tree keyboard commands.

Guides live inside the **existing unified help drawer** (the one commit e3536bb
turned into a searchable list), never a second drawer. A small number of
contextual "?" triggers open the drawer at a specific guide, and two dismissable
first-use callouts cover the only two places where a silent behavior changes the
author's data.

Out of scope: guided tours / coach-mark overlays, videos, inline screenshots
(text-only in v1), a PWA install/update guide (deferred — browser-dependent),
and embed-API host docs (developer-facing; stays in specs + the demo host page).

## Decisions (resolved with the team lead)

1. **Guides are a section inside the existing help drawer**, listed alongside
   the question-type reference and searchable through the same search box (the
   shared matching extended to guides). No separate drawer.
2. **v1 = the 8 guides** above; PWA install/update deferred. Text-only, no
   screenshots (the live web-forms preview already shows real rendering).
3. **Callouts only for the two data-changing traps** — the Translations dialog
   (display-language retargeting + no fallback language) and the logic builder's
   forced raw-mode. Dismissable, persisted in the `ui` store
   (`dismissedCallouts: string[]`). Everything else is pull-based "?" triggers —
   no popup fatigue.
4. **Contextual "?" triggers open the drawer directly at the guide**
   (`data-testid` per guide); no per-step deep links.
5. **All strings in the typed i18n catalog.** A **new `guides.json` namespace**
   (not `help.json`) — forced by the i18n shallow-merge model (`help.json`
   already owns the `help` namespace) and cleaner for parallel string work.
   English elsewhere stays byte-stable; guides carry a `docsUrl` deep link to
   docs.getodk.org where an equivalent page exists.

## Additional decisions made while shaping against the code

- **Store**: `editor.helpGuideId` + `openGuideHelp(key)` mirror the existing
  `helpTypeId` + `openTypeHelp`. Drawer detail mode = "a type or a guide is
  selected"; both null = the browsable list.
- **Type safety comes for free**: `MessageKey = NestedKey<typeof en>`, so
  registering `guides.json` in the `en` merge auto-extends the key space and
  vue-tsc validates every `guideHelp` step key. eslint `no-missing-keys`
  auto-discovers the file via its `src/i18n/locales/*/*.json` glob.
- **Library needs the drawer mounted.** The drawer renders only inside
  `EditorDialogs` (editor route) today; the library-toolbar "?" requires mounting
  `QuestionTypeHelpDrawer` in `FormLibraryView`. Safe because the editor and
  library routes never coexist.
- **Entities trigger goes in `EntitySection.vue`, not `FormSettingsDialog.vue`**,
  to avoid colliding with the in-flight settings-page feature.
- **Content is one package** (single namespace = single owner); parallelism is
  across the drawer/callout/trigger/test packages.

## Context

- **Visuals:** None (text-only feature; no mockups).
- **References:** the in-app help system
  (`docs/specs/2026-07-10-0850-in-app-help/`, `src/help/`,
  `src/components/help/`) is the direct pattern; the eight source `user-guide.md`
  files supply the guide prose. See `references.md`.
- **Product alignment:** delivered Phase 2 offline-first, no-backend,
  no-telemetry SPA; guidance ships bundled in the i18n catalog, works offline,
  and honors the pure-`src/core`, i18n-only-strings, and preserve-testids
  invariants (`CLAUDE.md`).

## Skills & Conventions Applied

- **unops-toolkit:shape-spec** — used to structure this spec folder.
- **Repo i18n convention** — typed per-namespace catalog under
  `src/i18n/locales/en/`, `useAppI18n()` in components, `no-missing-keys` as an
  error. See `standards.md`.
- **Repo help convention** — typed registry index (`content.ts`) → i18n text,
  shared search (`search.ts`), one shared detail renderer. See `standards.md`.

## Code review outcome (2026-07-10, five lenses)

No correctness bugs (mutual-exclusion, callout gating, persistence
robustness, catalog resolution, and the modal↔drawer handoff all traced
clean). Byte-stability, data-testid, and guide-copy factual audits passed
(keyboard/backup/templates/translations copy verified against the actual
code and catalog). Findings applied:

- The library view now lazy-loads the help drawer (`defineAsyncComponent`
  + open-gate) — mounting it statically had pulled the help graph
  (drawer + guide/type content + search, ~27 KB built) into the
  landing-route chunk. (The question-types registry itself stays a
  library dependency via the form-create/import paths — pre-existing and
  unrelated to the drawer.)
- The library "?" reverted to plan (Package H): it opens the drawer
  guides LIST (`library-help`, aria "Help & guides" via the previously
  orphaned `guides.ui.libraryHelp`) instead of deep-linking the backup
  guide.
- `CalloutId` union type added beside `GuideKey`; the search matcher
  extracted into `matchesFields` in `help/search.ts` (standards required
  one matching rule); the two "Learn more" trigger rows share one
  implementation; the trigger-icon CSS hoisted to a shared utility class;
  the drawer derives a single `mode` computed and routes list clicks
  through the store openers; comment trims; no-docsUrl branch pinned by a
  test; TranslationsDialog header a11y FIXED — the custom #header slot
  had left PrimeVue's computed `aria-labelledby` pointing at a
  nonexistent element (empty accessible name); the title span now carries
  an explicit id the dialog references, naming it "Translations" and
  excluding the "?" trigger.

Deferred as intentional/recorded:

- `storageHintDismissed` stays a separate boolean pref (shipped key;
  migrating risks re-showing the hint for existing users; semantically a
  persistence nudge, not a guide callout).
- Help-drawer state persisting across editor→library Back-navigation
  (asymmetric with the editor's mount-reset) — acceptable; the library is
  a legitimate drawer surface.
- `settle`/`makeRouter` test-helper promotion into the shared helpers
  (pre-existing duplication the new specs merely follow).
- The `p-dialog-title` class reuse is a soft PrimeVue dependency —
  acceptable while PrimeVue is exact-pinned (`pnpm verify:webforms`).
