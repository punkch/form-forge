# Retire the "Default" language column — default text converts into the first named language (+ backlog cleanup)

## Context

The Translations dialog always shows a "Default" column beside named languages,
the properties panel offers a "Default" pseudo-language in its editing-language
dropdown, and the web-forms preview only ever lists named languages — so
default-column content is invisible in the preview and confusing to author.

Research confirms the ecosystem treats bare/default + named-language mixing as
a bug, not a feature: pyxform turns a bare column into a language literally
named "default" and pads all gaps with `"-"`; XLSForm docs warn the bare column
"will be treated as if it were a separate language"; clients have **no fallback**
(a missing string renders blank/dash — `default_language` only picks the
pre-selected language); Kobo's model is "first define the default language —
existing text belongs to it"; ODK Build's unnamed/uncoded default caused
Central rejections (build#260). Golden `translated.xml` (pyxform 4.5.0) has
only named `<translation>` blocks with `default="true()"` — no "default" entry.

**Goal:** builder-authored docs are always one of two clean shapes:
- **Shape A (zero languages):** all text under the `DEFAULT_LANG` (`'default'`)
  sentinel key; serialized inline.
- **Shape B (≥1 language):** all text under named keys, NO sentinel content,
  `settings.defaultLanguage` always one of `doc.languages`.

Mixed shape exists only transiently in imported/legacy docs; it auto-merges at
load/import boundaries, with unresolvable conflicts kept visible until cleared.

## User decisions (2026-07-16 shaping, fixed)

1. **Zero-language grid** keeps ONE editable column for the form's text.
2. **Conversion is silent + automatic**: adding the first language MOVES all
   sentinel content into it and sets it as `settings.defaultLanguage`;
   undo-able via the normal mutate undo, no prompt.
3. **Mixed docs auto-merge on load**: sentinel text fills the primary
   language's empty cells then clears; where both sides have text the named
   language wins for display but the sentinel cell stays visible (grid
   "Unassigned" column + validation warning) until resolved. Nothing lost.
4. **Backlog cleanup**: delete `docs/specs/backlog/` entirely (git history is
   provenance); migrate the 3 follow-ups that live only in its README.

Accepted consequences (surfaced at approval): (a) multilingual XLSForm exports
no longer emit bare `label`/`hint` columns (ecosystem-correct); (b) the
Default-language select loses its clear "×" (Shape B always has a default);
(c) removing the only language keeps unresolved Unassigned text and drops the
removed language's value in those conflict cells (never silently overwrite;
undo recovers).

## Invariants that constrain the design

- Serializer/parser/XLSForm reader+writer stay **byte-for-byte untouched**
  (goldens pinned to pyxform 4.5.0; round-trip gates call
  parseXForm→serializeXForm directly). Normalization is model-level only.
  Serializer already emits `default="true()"` on the first translation and
  hoists `settings.defaultLanguage` first (`serializer.ts:186-190,578-582`);
  its `text[lang] ?? text[DEFAULT_LANG]` fallback stays as robustness.
- Parser edge case stays pinned (`src/core/xform/parser.spec.ts:55-57`): an
  XForm with `<translation lang="default">` yields `doc.languages` CONTAINING
  `'default'` — then the sentinel key IS a named language; normalization and
  the grid's sentinel column must no-op/guard on `languages.includes(DEFAULT_LANG)`.
- `src/core` purity; Issue messages verbatim English; i18n keys change in all
  three catalogs (en/fr/es, typecheck-enforced); preserve `data-testid`s
  except deliberately retired ones; conventional commits (no co-author
  trailers).

## Design

### Core ops (`src/core/model/translations.ts`)

- **New `primaryLang(doc): Lang`** — zero languages → `DEFAULT_LANG`;
  `settings.defaultLanguage` ∈ languages → it; else `languages[0]`. Single
  resolver used by factory, useEditingLanguage, grid, display, normalize.
- **New internal `mergeDefaultInto(doc, target): {changed, conflicts}`** — one
  `transformLocalizedTexts` pass (covers labels, hints, guidance, bind
  messages, node+choice media, translated customColumns, choice labels — media
  filenames and customColumns move like text). Per text with sentinel value v:
  undefined→skip; `''`→delete key (debris); target empty→MOVE; target
  identical→dedupe-delete; both non-empty different→CONFLICT (keep both,
  count it). Returns undefined for emptied texts (removeLanguage's contract).
- **New `normalizeDefaultContent(doc): {changed, conflicts}`** — no-op when
  `languages.length === 0` or `languages.includes(DEFAULT_LANG)`; else
  `mergeDefaultInto(doc, primaryLang(doc))`. Does NOT auto-set
  `settings.defaultLanguage` (would alter re-export of imports). Idempotent.
- **`addLanguage` (:88) copy → MOVE**: on first language, set
  `settings.defaultLanguage = lang` then `mergeDefaultInto(doc, lang)`.
  Subsequent adds unchanged. Undo free via existing `form.mutate` wrap.
- **`removeLanguage` (:105)**: last language → each removed value moves back
  to the sentinel unless a leftover sentinel value exists (conflict rule (c));
  delete `settings.defaultLanguage`. Non-last removal of the default →
  reassign `languages[0]`. Symmetry: add(FR)→remove(FR) restores the exact
  original sentinel shape.
- **Factory (`src/core/model/factory.ts:50-53,83,93`)**: `createNode` +
  `newChoiceList` seed labels under `primaryLang(doc)` (DEFAULT_CHOICES const
  becomes per-call). Verified only sentinel-seeding paths; `ChoicesSection.vue:75`
  seeds `label: {}` (fine); bundled templates are already clean Shape B.
- **`useEditingLanguage.ts`**: `editor.displayLanguage === null` now means
  "follow the form's primary language" (was: sentinel):
  `editingLang = clampedDisplayLanguage ?? primaryLang(doc)`; expose
  `primaryLang`; `isTranslating = languages.length > 0 && editingLang !== primaryLang`
  (badge only on non-primary). A null displayLanguage can never write sentinel
  content in a multilingual doc again. Update comment `src/stores/editor.ts:32`.

### Normalization call sites (decision 3)

1. `migrateDoc` (`src/core/model/migrate.ts:43`) — covers archive read
   (`archive.ts:259`), templates (`templates/index.ts:26`,
   `NewFormDialog.vue:100`), embed bridge (`bridge.ts:223`).
2. `parseFormFile` (`src/core/import-form.ts:15`) — XForm + XLSForm file imports.
3. Central import (`src/core/central/import.ts:65`) — after parseXForm.
4. `form.load` (`src/stores/form.ts:213`) — Dexie bypasses migrateDoc:
   normalize the clone BEFORE assigning `doc.value` (clean undo stack; the
   merge is a load-time migration, not an undoable edit); if changed,
   `scheduleSave()` after `runValidation()`. Idempotent so an unsaved merge
   re-applies harmlessly next load.

### UI behavior matrix

| Surface | A: zero languages | B: languages, clean | Mixed: leftover sentinel |
|---|---|---|---|
| Grid columns | String + one **"Text"** column (sentinel-keyed; testids stay `cell-<siteKey>-default`) | String + language columns only | + warning-tinted **"Unassigned"** column (same testids) + explanatory note |
| Grid toolbar | hide "untranslated only" | both toggles | both toggles |
| Show-in-editor select | hidden | named languages only; shows `displayLanguage ?? primaryLang` | same |
| Default-language select | hidden (gate on languages) | no show-clear | same |
| Panel `panel-editing-language` | not rendered (existing gate) | named languages only; shows primaryLang when null | same |
| LocalizedInput badge/placeholder | never | badge only editing non-primary; placeholder falls back to primary text | same |
| Canvas/ProblemsButton/library cards | unchanged | display via `editingLang`/`primaryLang` (chain: requested → primary → sentinel → first non-empty; `displayText` itself unchanged) | leftover text still displays — nothing goes blank |

Sentinel-column rule: `languages.length === 0 || (!languages.includes(DEFAULT_LANG) && sites.some(s => hasText(s.text[DEFAULT_LANG])))`; header `textColumn` vs `unassignedColumn`; disappears reactively when the last sentinel value clears. Resolution = editable cells + note (no extra buttons). Grid's `addLanguageFirst` note retired (grid always usable).

### Validation & i18n

- New warning `i18n.unassigned-text` (existing `warning()` factory,
  `src/core/validate/translations.ts`), fired per node / per choice list with
  sentinel content when `languages.length > 0 && !languages.includes(DEFAULT_LANG)`.
  Messages: `"q1" has text not assigned to any language.` (scope nodeId) /
  `Choice list "states" has text not assigned to any language.` (scope listName).
- i18n (en+fr+es `dialogs.json`): REMOVE `translationGrid.defaultColumn`,
  `translationGrid.addLanguageFirst`, `translations.defaultOption`,
  `translations.unsetPlaceholder` (grep-verified consumers all edited here).
  ADD `translationGrid.textColumn`, `translationGrid.unassignedColumn`,
  `translationGrid.unassignedHint`, `translations.removeLastWarning`
  (fr/es terms per the 1125-spec glossary).

## Tasks

### Task 1 — Save spec documentation (FIRST)

Create `docs/specs/2026-07-16-<HHMM>-translations-default-language/`:
- `plan.md` — this plan IN FULL (no summarizing)
- `shape.md` — scope, the 4 decisions + 3 accepted consequences, context
- `standards.md` — repo invariants that bind this work (core purity, i18n
  3-catalog typecheck, testid preservation, golden byte-stability, delivery
  process) with why each applies
- `references.md` — codebase anchors (translations.ts, grid/dialog,
  serializer/parser lines, load paths) + ecosystem citations
  (docs.getodk.org/form-language, getodk.github.io/xforms-spec, pyxform
  #157/#609 + forum 25732, Kobo language docs, ODK Build #260)
- `user-guide.md` — authoring flow + manual test scenarios (matrix above)
- `visuals/` — the three user screenshots from
  `/home/punkch/.claude/image-cache/8b997478-bfa1-4420-b297-a0d1232c46a8/{3,4,5}.png`

### Wave 1 — core (T2/T3 parallel after T1; T4/T5 after T2)

- **T2 model ops** — translations.ts changes above + comment updates
  (`types.ts:15-23`). Tests: rewrite `translations.spec.ts:175-191` (move +
  defaultLanguage set), `:194-241` (last-language restore, default
  reassignment, conflict-cell retention); new `normalizeDefaultContent`
  describe: merge/dedupe/conflict-count/empty-string debris/idempotence/no-op
  on Shape A and literal-default/media+customColumns+choice coverage.
- **T3 validator** — `i18n.unassigned-text` + `validate.spec.ts` cases (fires
  per node/list on mixed; silent on A, B, literal-default).
- **T4 factory** — seeds via `primaryLang`; extend `factory.spec.ts` (Shape B
  doc seeds default language; Shape A seeds sentinel).
- **T5 normalization call sites** — migrate.ts, import-form.ts,
  central/import.ts, form.ts load (+ each spec: mixed→merged, conflicts kept,
  scheduleSave on change, clean load stays 'saved', undo stack empty). Check
  `workspace-full-backup.spec.ts` fixtures stay clean-shaped.

### Wave 2 — UI (parallel after Wave 1)

- **T6 editing-language seam** — useEditingLanguage.ts, `LocalizedInput.vue:37-43`,
  `PropertyPanel.vue:40-51` (drop Default option), `TreeNodeCard.vue:33`,
  `ProblemsButton.vue:37`, `display.ts:28` (`documentPreviewLabels` via
  primaryLang), `editor.ts:32` comment. Tests: rewrite
  `tests/component/display-language.spec.ts` (Shape B fixtures; "writes the
  primary language"; badge needs a second language; keep one deliberate
  mixed-doc sentinel-fallback display test).
- **T7 grid + dialog + i18n** — `TranslationGrid.vue:84-133` (matrix;
  `--odk-warning-*` tokens for Unassigned tint), `TranslationsDialog.vue:45,65-81,185-212`
  (show-clear removal, removeLastWarning when languages.length===1, stale
  comment), three `dialogs.json` catalogs. Tests: `tests/component/translations.spec.ts` —
  move expectations at :58-65; :79-92 stays green; Shape B grid asserts NO
  `cell-…-default`; new zero-language Text-column test; Unassigned column
  appears/disappears; removeLastWarning.

### Wave 3 — e2e + docs

- **T8 e2e** — `tests/e2e/translations.spec.ts`: `:44` counts unchanged; `:67`
  `<translation lang="French (fr)" default="true()">` unchanged (serializer
  output byte-identical for equivalent docs); drop `-default` cell
  interactions (:102,:126,:151); rewrite :154-196 (after adding French the
  panel reads "French (fr)", no Default option; add Spanish for badge/switch).
  Preserve remaining testids.
- **T9 docs sweep** — CLAUDE.md code-map rows (translations.ts, factory.ts,
  useEditingLanguage), README Features wording, roadmap entry — same commit.

### Task 10 — backlog cleanup (independent; user decision: delete folder)

1. Migrate the 3 follow-ups living ONLY in `docs/specs/backlog/README.md`
   into a "Known follow-ups" subsection of `docs/product/roadmap.md`:
   (a) `track-changes-reasons` audit param mistyped — boolean today, docs
   specify literal token `on-form-edit` (registry type→'string'+options,
   TypeConfigSection.vue write logic, golden check); (b) PrimeVue built-in
   aria labels stay English under fr/es — per-locale PrimeVue locale map
   wired into `setLocale`; (c) drag-and-drop upload into AttachmentsDialog.
2. `git rm -r docs/specs/backlog/` (10 delivered docs + README; 8 are
   promotion stubs, central-publishing.md + theming.md keep full shaping
   bodies in git history).
3. Update inbound references: `docs/product/roadmap.md:215-216` (drop the
   backlog README link), `CLAUDE.md:158` (remove stub sentence), `CLAUDE.md:160`
   (Documentation-index bullet → "backlog folder is created on demand; git
   history holds delivered shaping docs"), `CLAUDE.md:169` (process: "shape it
   in `docs/specs/backlog/` (create the folder when a new proposal appears)").
   Leave delivered specs' internal `references.md` back-references as-is.

## Execution & verification (established delivery process)

Implement via a dynamic Workflow with parallel agents per the wave structure.
Then:

1. `pnpm test` (unit + component + golden gates — zero golden regeneration;
   no engine-file diffs is the structural proof), `pnpm test:coverage`
   (floors: core 86/78/88, stores 80/85).
2. `pnpm lint` + `pnpm typecheck` (fr/es catalog parity compile-enforced).
3. `pnpm test:e2e` (chromium + firefox vs built app).
4. Agent-browser manual pass logged to `docs/verification/`: (a) new form →
   single Text column; (b) add French → content moves, panel reads
   "French (fr)", no badge, canvas unchanged, undo restores; (c) add Spanish →
   badge + fallback placeholder; (d) import mixed XLSForm (bare label +
   `label::French (fr)` + one conflict) → Unassigned column + warning; clear
   conflict → both disappear; (e) remove last language → text returns to Text
   column; (f) bilingual XLSForm export has no bare columns; XForm export
   unchanged; (g) preview language picker lists named languages only.
5. `/code-review` (five lenses, no plan mode); fix findings immediately.
6. Conventional commits (no co-author trailers), e.g.
   `feat(translations): convert default text into the first named language`
   and `docs(specs): retire the delivered backlog folder`; update README
   Features, roadmap, CLAUDE.md in the same change.
