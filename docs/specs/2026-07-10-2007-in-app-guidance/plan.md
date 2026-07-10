# In-app guidance for workflow features — Plan

Promotes `docs/specs/backlog/in-app-guidance.md`. Adds a third help category —
**workflow guides** — to the existing unified help drawer, plus a handful of
contextual "?" triggers and two dismissable first-use callouts. Everything is
bundled, offline, text-only, and flows through the typed-registry → i18n-catalog
pattern already established by the in-app help system
(`docs/specs/2026-07-10-0850-in-app-help/`).

## Goal

An author who does not already know a multi-step feature can discover and learn
it without leaving the app:

- The help drawer (opened from the editor header Help button, and from a new
  library-toolbar "?") lists the eight v1 guides alongside the question-type
  reference, searchable through the same search box.
- Five feature home surfaces gain a "?" affordance that opens the drawer
  directly at the relevant guide.
- The two silent-data-change traps — the Translations dialog (display-language
  retargeting + no fallback language) and the logic builder's forced raw-mode —
  show a dismissable callout the first time, persisted so it never nags again.
- All guide/callout/chrome strings live in the typed i18n catalog; existing
  rendered English stays byte-stable; guides deep-link to docs.getodk.org where
  an equivalent page exists.

## v1 guide list (8)

| GuideKey | Guide | Contextual "?" home | docs.getodk.org deep link |
| --- | --- | --- | --- |
| `translations` | Translating a form | Translations dialog header | form-language page (verify anchor) |
| `logic` | Visual logic builder | ConditionBuilder header | form-logic page (verify anchor) |
| `datasets` | External datasets (CSV/GeoJSON) | Choices section (itemset file) | form-datasets / attachments (verify) |
| `entities` | Entities & follow-up forms | Entity section header | entities page (verify anchor) |
| `backup` | Backing up your workspace | Library toolbar (drawer list) | none (app-specific) |
| `templates` | Starting from a template | Library toolbar (drawer list) | none (app-specific) |
| `autosave` | Autosave & crash snapshots | Library toolbar (drawer list) | none (app-specific) |
| `keyboard` | Keyboard commands | drawer list only (pull) | none (app-specific) |

Callouts (2), keyed for `ui.dismissedCallouts`: `translations` (display-language
retargeting + no-fallback rule) and `logicRaw` (why the Visual toggle is
disabled and the expression stays in raw).

## Architecture

### Content model (typed registry → i18n catalog)

`src/help/content.ts` grows a guide registry mirroring `typeHelp`/`fieldHelp`:

```ts
export interface GuideHelp {
  title: MessageKey
  summary: MessageKey
  steps: MessageKey[]          // variable length per guide; each a literal key
  searchKeywords?: string[]    // plain-English synonyms (like registry searchKeywords)
  docsUrl?: string             // absolute docs.getodk.org URL where one exists
}
export type GuideKey =
  | 'translations' | 'logic' | 'datasets' | 'entities'
  | 'backup' | 'templates' | 'autosave' | 'keyboard'
export const guideHelp = { … } satisfies Record<GuideKey, GuideHelp>
```

English text lives in a **new namespace file** `src/i18n/locales/en/guides.json`
(single top-level key `"guides"`), holding `guides.<key>.title`,
`guides.<key>.summary`, `guides.<key>.steps.*`, the drawer guide-section chrome
(`guides.ui.*`), and the two callouts' copy (`guides.callouts.*`). Registered in
`src/i18n/locales/en/index.ts` (import + spread into `en`).

Why a new namespace and not `help.json`: the i18n merge in `locales/en/index.ts`
is a **shallow** object spread keyed by each file's single top-level key, and
`help.json` already owns `"help"`. A second file with top-level `"help"` would
clobber it. A distinct `"guides"` namespace also keeps guide authoring off the
20 KB `help.json`, matching the "one JSON file per app area so parallel
string-extraction never collides" convention in `index.ts`.

Why this is type-safe with no extra wiring: `MessageSchema = typeof en` and
`MessageKey = NestedKey<MessageSchema>` (`src/i18n/index.ts`). Registering
`guides.json` in the `en` merge automatically extends `MessageKey` with every
`guides.*` path, so vue-tsc rejects a `guideHelp` entry that references a missing
or misspelled key. The eslint `@intlify/vue-i18n/no-missing-keys` rule's
`localeDir` glob is `src/i18n/locales/*/*.json`, so it auto-discovers
`guides.json` with no config change.

`src/help/guides.ts` (new, sibling of `search.ts`) exposes the ordered
`GUIDE_KEYS: GuideKey[]` and a `guideDocsUrl(key)` resolver. Search over guides
is done in the drawer against the **resolved** (translated) title/summary plus
`searchKeywords`, because guide text is i18n-resolved at render time (unlike the
registry, whose searchable fields are plain data).

### Store

`src/stores/editor.ts` gains `helpGuideId: Ref<GuideKey | null>` and
`openGuideHelp(key)` — an exact sibling of `helpTypeId`/`openTypeHelp`. `reset()`
clears it. The drawer stays driven by `activeDialog === 'help-reference'`; detail
mode is now "a type is selected (`helpTypeId`) **or** a guide is selected
(`helpGuideId`)"; with both null it is the browsable list.

`src/stores/ui.ts` gains a persisted `dismissedCallouts: string[]`, a
`dismissCallout(id)` action, and an `isCalloutDismissed(id)` getter, threaded
through `PersistedUiState`, the loader, and the persistence `watch` exactly like
`storageHintDismissed`.

### Components

- `src/components/help/GuideContent.vue` (new) — renders one guide: title,
  summary, an ordered numbered step list, and an optional "Read more in the ODK
  docs" external link (reusing the `.help-read-more` pattern). Sibling of
  `QuestionTypeHelpContent.vue`.
- `src/components/help/QuestionTypeHelpDrawer.vue` (modify) — list mode renders a
  **Guides** section above the question-type category groups; the search box
  filters both. Detail mode renders `GuideContent` when `helpGuideId` is set,
  else `QuestionTypeHelpContent` when `helpTypeId` is set. The header title/back
  handling extends to guides. `data-testid="help-drawer"` unchanged.
- `src/components/help/GuideTrigger.vue` (new) — a compact "?" button variant
  that calls `editor.openGuideHelp(key)`; props `{ guide: GuideKey }`; renders
  `data-testid="guide-trigger-<key>"` with an aria-label from `guides.ui`. Unlike
  `HelpPopover` (which opens an inline popover for a field) this opens the drawer
  at a guide. A plain `<button>` is fine here (these sites are not inside a
  `<label>` wrapping a control, so the HelpPopover non-button workaround does not
  apply — verify per site).
- `src/components/help/GuideCallout.vue` (new) — an inline, dismissable panel:
  props `{ id: string }`; visible when `!ui.isCalloutDismissed(id)`; renders the
  callout title/body from `guides.callouts.<id>` and a dismiss button
  (`data-testid="guide-callout-<id>"` / `guide-callout-dismiss-<id>`) that calls
  `ui.dismissCallout(id)`. Optionally carries its own `GuideTrigger` to "learn
  more".

### Entry points and testids

- Editor header Help button — **unchanged**; now shows the Guides section
  because the drawer list mode renders it.
- Library toolbar — new "?" in `library-actions` opens the drawer list
  (`editor.activeDialog = 'help-reference'`), the only guide entry point in the
  library; requires mounting the drawer in `FormLibraryView` (see Package H).
- Contextual guide triggers: `guide-trigger-translations`, `-logic`,
  `-datasets`, `-entities`.
- Drawer list guide items: `help-guide-item-<key>`; guide detail container:
  `help-guide-<key>`.
- Callouts: `guide-callout-translations`, `guide-callout-logicRaw` (+ their
  dismiss buttons).

## Translation-coverage sequencing (must read)

The `translation-coverage` feature (`docs/specs/2026-07-10-2006-translation-coverage/`)
lands **before** this one and reshapes the Translations experience: the grid
gains empty-site and media rows, and a **visible editing-language control moves
into the properties panel** (per-language editing becomes explicit rather than
the current hidden "Show in editor" select). Therefore:

- Implementers of Package A (content) and Package D (Translations trigger/callout)
  **must read the Translations dialog and the properties-panel editing-language
  control as they actually exist at implementation time**, after
  translation-coverage has merged — not as captured in this plan.
- The `translations` guide and the `translations` callout copy must describe the
  **explicit** editing-language control and the fact that **the grid shows empty
  sites** (there is no fallback language; blank cells ship blank). Do not phrase
  it around the old hidden "Show in editor" select if that control has moved.

## Work packages

Parallelizable; no two packages own the same file. Packages D–H import from A/B/C
(types, `openGuideHelp`, `GuideTrigger`, `GuideCallout`) read-only — import is not
ownership. Package I is the final integration/e2e gate.

### Package A — Guide content model + catalog (largest; front-load)

Owns:
- `src/help/content.ts` — add `GuideHelp`, `GuideKey`, `guideHelp` registry,
  guide `docsUrl`s.
- `src/help/guides.ts` (new) — `GUIDE_KEYS`, `guideDocsUrl`.
- `src/i18n/locales/en/guides.json` (new) — all guide text (title/summary/steps),
  `guides.ui.*` drawer chrome and trigger aria-labels, `guides.callouts.*` copy.
- `src/i18n/locales/en/index.ts` — register `guides.json`.
- `tests/unit/guides-content.spec.ts` (new).

Does: authors the eight guides (content adapted from the source `user-guide.md`
files listed in `references.md` — the prose largely exists) as numbered,
task-oriented steps; keeps `content.ts` step counts in sync with the JSON (same
package, so no cross-agent drift). Verifies docsAnchor targets against live docs
where a link is claimed (fetch, don't guess — as the in-app-help spec did).

Tests: every `GuideKey` resolves title/summary and **every** step key to
non-empty catalog text; no orphan `guides.*` keys with no registry entry; guides
with a `docsUrl` produce a well-formed absolute `https://docs.getodk.org/...`
URL; the two callout ids resolve their `guides.callouts.*` copy.

Note — single namespace = single owner. The i18n shallow-merge model makes it
**impossible** to split one namespace across two files, so the catalog is one
package by necessity (see Code risks). Parallelism comes from B–I, not from
splitting A.

### Package B — Drawer guide rendering + store

Owns:
- `src/components/help/GuideContent.vue` (new).
- `src/components/help/QuestionTypeHelpDrawer.vue` (modify) — Guides section in
  list mode, guide detail mode, extended search.
- `src/stores/editor.ts` (modify) — `helpGuideId`, `openGuideHelp`, `reset()`.
- `tests/component/help-guides.spec.ts` (new).

Depends on A's `guideHelp`/`GUIDE_KEYS` (import-only).

Tests: list mode renders a Guides section with all eight items; typing a query
filters guides and types together and drops empty groups; clicking a guide opens
its detail (`help-guide-<key>`) with title/summary/steps; back returns to the
list; `openGuideHelp('logic')` opens the drawer straight to the logic guide.

### Package C — Callout component + ui-store persistence

Owns:
- `src/components/help/GuideCallout.vue` (new).
- `src/components/help/GuideTrigger.vue` (new).
- `src/stores/ui.ts` (modify) — `dismissedCallouts`, `dismissCallout`,
  `isCalloutDismissed`, persistence threading.
- `tests/component/guide-callout.spec.ts` (new).
- `tests/unit/ui-callouts.spec.ts` (new) — store persist/rehydrate of
  `dismissedCallouts`.

Depends on A (`guides.callouts.*` keys, `GuideKey`) and B (`openGuideHelp` for the
trigger) — import-only.

Tests: callout renders while its id is not dismissed and hides after the dismiss
button; `dismissCallout` adds the id and `isCalloutDismissed` reflects it; a
fresh ui store constructed after a persisted dismiss reports the id dismissed
(survives reload); `GuideTrigger` renders `guide-trigger-<key>` and calls
`openGuideHelp`.

### Package D — Translations dialog trigger + callout

Owns:
- `src/components/translations/TranslationsDialog.vue` (modify) — `GuideTrigger`
  in the dialog header (`guide-trigger-translations`) and `GuideCallout id="translations"`
  near the language panel top.

Depends on A/B/C. **Read the post-translation-coverage dialog first** (see
sequencing note). Copy stresses: the editing-language control changes which
language your edits are saved to; ODK has no fallback language, so blank cells
ship blank — fill every language.

Test: focused component test — header renders `guide-trigger-translations` and
clicking it calls `openGuideHelp('translations')`; callout visible when not
dismissed. (Full dismiss-survives-reload flow lives in Package I e2e.)

### Package E — Logic builder trigger + raw-mode callout

Owns:
- `src/components/logic/ConditionBuilder.vue` (modify) — `GuideTrigger guide="logic"`
  in the `builder-header`; `GuideCallout id="logicRaw"` rendered when the builder
  is in **forced** raw mode (`!canVisual`), explaining that the expression can't
  be represented visually so it stays in raw.

Depends on A/B/C. The callout is global-dismissed (once dismissed it stays
dismissed across both `relevant` and `constraint` instances), and only rendered
when `!canVisual`, so it does not double-nag. Test: component test —
`guide-trigger-logic` present and wired; feeding a builder an unparseable
expression renders `guide-callout-logicRaw` until dismissed.

### Package F — Dataset (choices) section trigger

Owns:
- `src/components/properties/ChoicesSection.vue` (modify) — `GuideTrigger guide="datasets"`
  near the itemset-file / external-file affordance (the dataset home surface).

Depends on A/B. Test: component test — `guide-trigger-datasets` present for a
file-backed select and wired to `openGuideHelp('datasets')`.

### Package G — Entity section trigger

Owns:
- `src/components/properties/EntitySection.vue` (modify) — a small header row with
  `GuideTrigger guide="entities"` above the `save_to` field.

Depends on A/B. **Do not touch `FormSettingsDialog.vue`** — the in-flight
settings-page feature (task #23) owns it; putting the entities trigger in
`EntitySection.vue` avoids a merge collision. Test: component test —
`guide-trigger-entities` present and wired.

### Package H — Library toolbar trigger + drawer mount

Owns:
- `src/views/FormLibraryView.vue` (modify) — a "?" button in `library-actions`
  opening the drawer list (`editor.activeDialog = 'help-reference'`), and mount
  `<QuestionTypeHelpDrawer />` in the view (the library does not mount
  `EditorDialogs`, so the drawer must be added here for the trigger to have a
  surface). The editor and library routes are never mounted simultaneously, so a
  second mount of the drawer is safe.

Depends on B (drawer). Test: component test — the toolbar renders the guide "?"
and the drawer becomes visible when clicked.

### Package I — Integration, e2e, docs

Owns:
- `tests/e2e/guides.spec.ts` (new).
- Docs: README Features row, `docs/product/roadmap.md`, `CLAUDE.md` code-map/help
  section, and this spec's `user-guide.md` verification checklist. Move the
  delivered shaping out of `docs/specs/backlog/in-app-guidance.md` per the
  delivery process (backlog README).

Runs last; depends on A–H. e2e covers: (1) editor header Help → drawer list shows
the Guides section → search "logic" → open the visual-logic guide and see its
steps; (2) a contextual trigger — open Translations, click
`guide-trigger-translations`, assert the drawer opens at `help-guide-translations`;
(3) callout lifecycle — first open of the Translations dialog shows
`guide-callout-translations`, dismiss it, reopen (gone), reload the page, reopen
(still gone). Also runs `pnpm build` to confirm the PWA precache manifest still
generates within size expectations (text-only additions are negligible against
the 8 MB per-file cap).

## Verification commands

```bash
pnpm lint            # includes @intlify/vue-i18n/no-missing-keys (error)
pnpm typecheck       # vue-tsc validates every guideHelp MessageKey
pnpm test            # unit + component (guides-content, help-guides, guide-callout, ui-callouts)
pnpm test:e2e        # tests/e2e/guides.spec.ts
pnpm build           # PWA precache manifest still within size expectations
```

Plus an agent-browser manual pass logged to `docs/verification/` (drawer guide
list + search, each contextual trigger, both callouts including dismiss-survives-
reload), per the delivery process.

## Acceptance (from backlog)

- Help drawer lists the v1 guides and finds them by search — Packages A, B.
- Translations dialog header "?" opens the translations guide — Package D.
- First open of the Translations dialog shows a dismissable callout explaining
  display-language retargeting and the no-fallback rule; dismissal survives
  reload — Packages C, D; e2e in I.
- All guide strings in the i18n catalog; `no-missing-keys` clean; English
  elsewhere byte-stable — Package A; `pnpm lint` in verification. New keys only;
  no existing rendered string is reworded.
- e2e covers drawer-open → search → guide render + one contextual trigger —
  Package I.
- PWA precache still passes size expectations — `pnpm build` in Package I.

## Code risks found

1. **i18n one-namespace-per-file forbids splitting the catalog.** The `en` merge
   is a shallow spread keyed by each file's top-level namespace; two files cannot
   both contribute to `guides.*`. So the guide catalog is a single file/owner
   (Package A) — the content package cannot be parallel-split "per guide group"
   as the shaping brief floated. Parallelism is achieved across B–I instead.
2. **The help drawer is editor-only today.** `EditorDialogs.vue` (mounted by
   `FormEditorView`) is the only place `QuestionTypeHelpDrawer` renders; the
   `FormLibraryView` does not mount it. The library "?" (Package H) requires
   mounting the drawer in the library view. It is driven by the global `editor`
   store, so this works, but it is a cross-view use of an "editor" store —
   acceptable (Pinia is global; the routes never coexist) and worth noting.
3. **Translations surface is a moving target.** translation-coverage reshapes the
   dialog and moves the editing-language control into the properties panel before
   this feature starts. Packages A and D must read the live surface, not this
   plan, and must NOT reword any existing translations string (byte-stable
   invariant) — only add new guide/callout keys.
4. **`FormSettingsDialog.vue` contention.** The entities declaration UI lives in
   the settings dialog, which the in-flight settings-page feature owns. The
   entities guide trigger goes in `EntitySection.vue` instead to avoid a
   two-feature edit of the same file.
5. **Autosave/snapshots has no surfaced recovery UI.** The snapshots table and
   pruning exist in persistence, and an `open`-kind snapshot is written on form
   open, but there is **no user-facing restore/recovery entry point** in the
   current views. The `autosave` guide must describe autosave, the four
   SaveIndicator states, the beforeunload guard, and snapshots as the durable
   crash-recovery layer — but Package A must confirm the actual recovery entry
   point (if any) before writing a "restore from a snapshot" step, and phrase the
   guide to what the app truly exposes.
6. **Callout double-render in the logic builder.** `ConditionBuilder` mounts once
   per expression field (relevant + constraint). The `logicRaw` callout must be
   keyed by a single global id and only rendered when `!canVisual`, so dismissing
   it once hides it everywhere — otherwise a forced-raw constraint and a
   forced-raw relevance would show two callouts.
7. **GuideTrigger as a real `<button>`.** `HelpPopover` deliberately avoids being
   a `<button>` because it sits inside a field `<label>`. The guide triggers sit
   in dialog/section headers and toolbars, not inside labels, so a plain button
   is correct — but each call site (Packages D–H) must confirm it is not nested
   in a labelable control before using one.
