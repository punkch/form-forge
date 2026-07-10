# References for UI Critique Fixes

Findings from three parallel exploration passes (logic/validation, UI
chrome, tests/conventions), 2026-07-10. Paths relative to repo root.

## Logic builder & validation

### Field option enumeration
- **Location:** `src/components/logic/field-options.ts` (`logicFieldOptions`)
- **Relevance:** includes every `kind === 'question'` node — notes included.
- **Key patterns:** the clean "holds no user value" marker is
  `getQuestionType(type)?.xform.readonlyDefault === true` (only `note`).
  Filtering by `category === 'display'` would wrongly drop `calculate`.

### Condition defaults
- **Location:** `src/components/logic/ConditionBuilder.vue` (`defaultCondition`,
  ~L122–128; field list ~L49–56), `src/components/logic/ConditionRow.vue`
- **Relevance:** constraint correctly defaults to `.` (self); relevance falls
  back to `fields.value[0]` — first node in doc order, i.e. the intro note.

### Structured grammar
- **Location:** `src/core/expr/structured.ts` (`Comparison`, `SelectedPred`,
  `trySerializeStructured`, parse side)
- **Key patterns:** empty literal `''` is representable → serializes to
  `${field} = ''`, so it passes straight through validation today.

### Validation pipeline
- **Location:** `src/core/validate/index.ts` (validator registry),
  `expressions.ts` + `expression-sites.ts` (skips `trim() === ''` exprs at
  `expression-sites.ts:12`), `issues.ts` (`error/warning/info(code, message,
  scope)`, `IssueScope.nodeId`)
- **Reality check:** CLAUDE.md's "UI localizes issues by code" is **not
  implemented** — every surface renders `issue.message` (English) verbatim
  (`ProblemsButton.vue:60`, `ExpressionInput.vue:126`, `BasicSection.vue:86`);
  codes are only used to filter. New issues follow the existing pattern.

### Problems rendering
- **Location:** `src/components/shell/ProblemsButton.vue` (rows ~L53–60,
  `goTo()` ~L27–33 already navigates via `issue.scope.nodeId`)
- **Key patterns:** node label resolution = `form.getNode(nodeId)` +
  `displayText(node.label, editor.displayLanguage ?? undefined)` fallback
  `node.name` — exactly what `TreeNodeCard.vue:27` does.

## UI chrome

### Header actions
- **Location:** `src/views/FormEditorView.vue` `#actions` slot (~L231–263) —
  NOT `AppHeader.vue`. Preview label gated on `mode === 'wide'`
  (`useBreakpoint()`: wide ≥1280 / laptop / tablet / blocked); `ExportMenu`
  `:compact="mode !== 'wide'"` drops its label; palette toggle is
  `pi pi-bars` (hamburger).
- **Existing to reuse:** palette auto-collapse already exists
  (`fitsWithPalette`/`effectivePaletteVisible` ~L71–81); preview-dock width
  math in `effectivePanelWidths` (~L89–110).

### Canvas cards
- **Location:** `src/components/canvas/TreeNodeCard.vue` — badges computed
  ~L34–51 (`{key, icon, title, text?}`), all already have
  `v-tooltip.top="badge.title"`; choice-list chip pattern = icon +
  `` `${listRef} (${count})` `` text. Label truncation: `.node-label`
  single-line ellipsis ~L276–282.
- **Test constraint:** `tests/component/tree-node-card.spec.ts` asserts
  exactly 5 `.node-badge` and appearance text `thousands-sep`.

### Library
- **Location:** `src/views/FormLibraryView.vue` rows ~L228–254
  (`.form-card`, `form-card-menu` testid, version via
  `library.card.version` → `v{version}`), empty state `library-empty`.
- **Record shape:** check `src/persistence/` form summary for available
  fields (languages likely absent — add to summary builder only if cheap).

### New Form dialog
- **Location:** `src/components/library/NewFormDialog.vue` — Create
  disabled = `title.trim() === '' || creating` (~L243); title input +
  `loadError` render on both steps (~L225–237) — hint goes there.

### Help surfaces (already share a body)
- **Shared renderer:** `src/components/help/QuestionTypeHelpContent.vue`;
  search machinery `src/help/search.ts` (`groupTypesBySearch`, shared with
  palette); typed content `src/help/content.ts`.
- **To unify:** `HelpReference.vue` (Dialog; search/list layer, testids
  `help-reference`, `help-search`, `help-ref-item-*`, `help-ref-detail`,
  `help-ref-back`) folds into `QuestionTypeHelpDrawer.vue` (Drawer, testid
  `help-drawer`) as a list mode when `editor.helpTypeId` is null. The
  duplicated header block (icon + title + token) is a clean extraction.

### Export / readiness
- **Location:** `src/components/importexport/ExportMenu.vue` (SplitButton,
  `blockOnErrors()` gates on `form.errorCount`); store computeds
  `form.issues`, `form.errorCount`, `warningCount` (used by
  `ProblemsButton.vue:17`) — no new computed needed for counts.
- **Untranslated count:** reuse whatever computes the per-language "30/30"
  in the Translations dialog (locate in `TranslationsDialog.vue` /
  translation grid helpers).

### Icons (primeicons only)
- Blocked screen: `pi pi-arrows-alt` → `pi pi-desktop`.
- Palette toggle: `pi pi-bars` → closest panel glyph available in the
  pinned primeicons version (verify candidates, e.g. `pi-objects-column`).

## Tests & conventions

- Component setup: `tests/setup/component.ts` (PrimeVue + shared `en` i18n
  global; Pinia per-test via `tests/component/helpers.ts` `freshPinia()` /
  `mountWith()`); PrimeVue Dialog needs a tick (`vi.waitUntil` pattern in
  `new-form-dialog.spec.ts`).
- String-coupled tests: e2e asserts issue-message substrings
  (`editor.spec.ts` "used 2 times", `dataset-tooling`, `entities`,
  `dataset-upload`); 9 `.message` assertions in `src/core/validate/*.spec.ts`.
  Don't change existing issue message text.
- Coverage floors run only under `pnpm test:coverage` (core 86/78/88,
  stores 80/85, persistence 90/92); CI runs lint + typecheck + `pnpm test`
  + playwright e2e.
- Goldens: serializer-only; none of this work can move them.
  `tests/golden/complex/` is untracked leftover scratch — ignore.
- e2e behavior specs most at risk: `tests/e2e/help.spec.ts` (drives the
  reference dialog testids — keep them on the drawer's list mode),
  `tests/e2e/layout.spec.ts` (1100/900/390 px modes).

## Upstream

- `@getodk/web-forms` number-input contradiction — draft issue in
  `upstream-issue-web-forms.md` (documentation only; no local patch).
