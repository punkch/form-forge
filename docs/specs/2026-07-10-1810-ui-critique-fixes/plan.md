# Plan — UI Critique Fixes (2026-07-10)

## Context

A whole-app design critique (Interface Craft five-lens methodology) was run
against the v1.0.0-RC1 production build on 2026-07-10 (32 states captured;
annotated artifact linked in `shape.md`). The user approved implementing
**all** findings and recommendations immediately, with four scope decisions
recorded in `shape.md` (upstream issue drafted not patched; header Help
opens the drawer; readiness = non-blocking Ready state + Export-menu
summary; full library card redesign). This plan turns the eleven findings
into concrete changes. Constraints and reusable patterns are in
`standards.md` / `references.md`.

Branch note: CLAUDE.md says "work on development" but no such branch exists
and all recent work + release-please target `main` — commits go to `main`,
matching actual practice.

## Task 1: Save spec documentation — DONE

`docs/specs/2026-07-10-1810-ui-critique-fixes/` with plan.md (this file),
shape.md, standards.md, references.md, upstream-issue-web-forms.md,
visuals/ (12 critique screenshots), user-guide.md (written with Task 8).

## Task 2: Logic-builder trust (core + logic components)

**Files:** `src/components/logic/field-options.ts`,
`src/components/logic/ConditionBuilder.vue`,
`src/core/registry/question-types.ts` (only if adding a derived helper),
`src/core/validate/expressions.ts` (+ `issues.ts`, `index.ts` if a new
validator is registered).

1. **Exclude notes from operands:** in `logicFieldOptions`, drop nodes
   whose registry entry has `xform.readonlyDefault === true`. Add a small
   exported predicate (e.g. `holdsUserValue(type)`) near the registry or in
   field-options; unit-test it (note excluded; calculate/meta kept).
2. **Default to nearest preceding answerable question:** `defaultCondition`
   for relevance picks the closest field *before* the current node in doc
   order (fall back to the first answerable field, then to no-op if none).
   `logicFieldOptions` already returns doc order — use the current node's
   position.
3. **Warn on empty comparison values:** new core check emitting
   `warning('expr.empty-condition-value', 'The condition on "<name>" compares
   against an empty value.', { nodeId })` (exact message finalized in code;
   keep existing messages untouched). Implement by structured-parsing
   relevant/constraint sites and flagging `Comparison`/`SelectedPred` with
   empty literal. Warnings don't gate preview/export (existing behavior).
4. **Tests:** extend `tests/component/condition-builder.spec.ts` fixture
   with a leading note (regression for the default bug); new unit spec for
   the validator + predicate + nearest-preceding selection.

## Task 3: Problems locations + readiness (shell + export)

**Files:** `src/components/shell/ProblemsButton.vue`,
`src/components/importexport/ExportMenu.vue`,
`src/i18n/locales/en/shell.json`, `src/i18n/locales/en/importExport.json`.

1. **Location labels:** each issue row shows the owning question's display
   label (resolve `form.getNode(issue.scope.nodeId)` →
   `displayText(node.label, editor.displayLanguage ?? undefined)` →
   fallback `node.name`), styled as a small prefix chip. Rows without
   nodeId (settings/translations/sheet scopes) show their scope kind.
2. **Group identical messages:** issues sharing `code + message` render as
   one message with one clickable location chip per node. Keep
   `problems-list` testid and existing message strings (e2e asserts
   substrings).
3. **Ready state:** when `form.issues.length === 0`, the problems button
   renders positive (check icon + localized "Ready" label + success
   severity); testid `problems-button` unchanged. Popover empty text
   (`shell.problems.empty`) unchanged.
4. **Export readiness summary:** first item of the SplitButton menu is a
   disabled summary line — errors>0: "N problems block export"; else
   "Ready · N warnings" plus "· M untranslated" if the translation
   completion helper is cheaply reusable (locate the "30/30" computation in
   the Translations dialog; skip the untranslated part if it isn't
   extractable without refactoring).
5. **Tests:** new component spec for ProblemsButton (locations, grouping,
   ready state); extend/export-menu spec if one exists.

## Task 4: Canvas + chrome polish

**Files:** `src/components/canvas/TreeNodeCard.vue`,
`src/views/FormEditorView.vue`, `src/components/shell/BlockedEditorScreen.vue`,
`src/i18n/locales/en/canvas.json`.

1. **Two-line labels:** `.node-label` single-line ellipsis → two-line clamp
   (`display:-webkit-box; -webkit-line-clamp:2`), `white-space:normal`.
2. **Badge labels:** relevant/constraint/calculation badges gain short
   localized `text` (e.g. "logic", "constraint", "calc" — final copy via
   canvas.json keys); `*` required and lock stay icon-only (tooltips already
   exist on all badges). Error badge's plain `:title` becomes a `v-tooltip`
   like the rest. Keep `.node-badge` class and 5-badge count
   (`tree-node-card.spec.ts` asserts it).
3. **Header labels:** preview button label no longer gated on
   `mode === 'wide'`; `ExportMenu` rendered non-compact at all modes.
   Verify 1024px header fits (title already ellipsizes; `layout.spec.ts`
   at 1100px must stay green).
4. **Icons:** palette toggle `pi pi-bars` → closest panel glyph in the
   pinned primeicons (verify availability first); blocked screen
   `pi pi-arrows-alt` → `pi pi-desktop`.
5. **Tests:** update `tree-node-card.spec.ts` for badge text; component
   snapshot-ish assertions for header labels if practical.

## Task 5: Library card redesign + New Form hint

**Files:** `src/views/FormLibraryView.vue`,
`src/components/library/NewFormDialog.vue`,
`src/i18n/locales/en/library.json`, possibly `src/persistence/` summary
builder (+ its spec) if adding a languages field.

1. **Card redesign:** richer two-zone card — title prominent; meta row as
   chips (question-count chip with `pi pi-list`; language badge like
   "EN · FR" only if the stored summary already has or can cheaply gain a
   `languages` field — if it requires touching archive/import paths, skip
   the badge and note it); formatted, deemphasized version; last-edited
   with emphasis. Preserve testids (`form-card-*`, `form-card-menu`) and
   the overflow menu.
2. **Version formatting:** pure helper formatting 12-digit timestamp
   versions as `v2026-07-10.1734` (anything else renders as-is), unit
   tested. Applied in the library card only (settings keeps the raw
   editable value).
3. **Create hint:** helper text under the title input when
   `title.trim() === ''` explaining what's needed (new
   `library.newFormDialog.createHint` key; visible on both steps; keep
   `new-form-*` testids and existing spec behavior).
4. **Tests:** update `new-form-dialog.spec.ts`; extend/create library view
   component spec for chips + version formatting.

## Task 6: Help-surface unification

**Files:** `src/components/help/QuestionTypeHelpDrawer.vue`,
`src/components/help/HelpReference.vue` (removed),
`src/stores/editor.ts`, `src/views/FormEditorView.vue` /
`EditorDialogs.vue` (wherever `help-reference` mounts),
`src/i18n/locales/en/help.json`.

1. Drawer gains a **list mode** when `helpTypeId` is null: search input +
   grouped type list (reuse `groupTypesBySearch` and the list markup from
   HelpReference), selecting a type switches to the existing detail view
   with a back affordance.
2. Header Help button opens the drawer in list mode (new/renamed editor
   store action); `activeDialog === 'help-reference'` path and
   `HelpReference.vue` are removed.
3. **Testid continuity:** `help-reference` (list-mode root), `help-search`,
   `help-ref-item-*`, `help-ref-detail`, `help-ref-back` move onto the
   drawer so `tests/e2e/help.spec.ts` keeps passing with minimal edits
   (update only what asserts Dialog-specific behavior).
4. Extract the duplicated header block (icon + title + token) into the
   shared content component if it falls out naturally.

## Task 7: Docs + index updates

- `README.md` Features: note the polish pass (problems locations, ready
  state, unified help, library cards).
- `docs/product/roadmap.md`: add this work package to the delivered list.
- `CLAUDE.md`: fix two stale facts found during exploration — logic
  components live in `src/components/logic/` (not `properties/logic/`),
  and the issues invariant reworded to match reality (stable codes;
  English `message` is rendered directly; codes used for filtering).
  Reference this spec folder.

## Task 8: Verification + review + commits

1. `pnpm lint && pnpm typecheck && pnpm test` then `pnpm build`,
   `pnpm test:e2e`.
2. agent-browser pass over the rebuilt app re-checking each finding
   (before/after screenshots) → log to
   `docs/verification/2026-07-10-ui-critique-fixes/` + write
   `user-guide.md` in the spec folder (manual test scenarios).
3. `/code-review` (five lenses, no plan mode); fix findings immediately.
4. Conventional commits on `main`, grouped by area:
   `fix(logic): …`, `feat(problems): …`, `fix(editor): …`,
   `feat(library): …`, `refactor(help): …`, `docs: …`.
   Do NOT commit `tests/golden/complex/` (untracked leftover).

## Execution

Tasks 2–6 run as parallel agents in a dynamic Workflow with strict file
ownership (no shared files across agents; i18n namespaces are per-task).
Task 7–8 run sequentially afterwards in the main loop.

## Verification (definition of done)

- All CI gates green: lint, typecheck, unit+component, e2e (chromium+firefox).
- Each of the 11 findings demonstrably fixed in the running app
  (agent-browser evidence in docs/verification/).
- No golden diffs; no removed data-testids; no new English hardcoded in
  components (i18n lint clean).
- Coverage floors still met (`pnpm test:coverage`).
