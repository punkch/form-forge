# Form Forge for ODK — Rebuild Plan

## Context

The repo holds a crude prototype (~5,400 lines): one giant `XFormBuilder.vue`, a good 36-type field registry, a spec-incomplete one-way XML generator (no itext, no calculate/appearance/constraint-message output), no import, no persistence, no tests. The product docs (PRODUCT_PLAN.md, REQUIREMENTS.md, TECHNICAL_SPECIFICATION.md, `.agent-os/product/*`) describe an older Material-Design-3 / backend-connected vision that is now superseded.

**Target**: a Vue 3 + TypeScript application that visually matches ODK Web Forms, runs **purely client-side with browser storage only** (IndexedDB, no backend ever), **imports** XForm XML and XLSForm (.xlsx), **exports** XForm XML, XLSForm (.xlsx), and ZIP (form.xml + media/CSV attachments), with updated packages and proper test coverage. Each delivery is verified with the `agent-browser` skill; product docs are refreshed with `plan-product`; each work package is shaped/recorded via the `shape-spec` conventions.

## User-confirmed decisions

| Decision | Choice |
|---|---|
| Exports | XForm XML + XLSForm (.xlsx) + ZIP with attachments |
| XLSForm engine | **Native TypeScript** (no pyxform/Pyodide); pyxform is the behavioral reference via golden tests |
| Approach | **Fresh rebuild** in this repo; prototype preserved in git history; port the registry and useful helpers |
| Widget scope | **Full XLSForm question-type list** (~40 types incl. groups/repeats, selects/cascades, geo, media, metadata, entities) |
| Design | **ODK Web Forms look** — adopt the `--odk-*`/`--p-*` tokens web-forms injects; M3/Figma design dropped |
| Layout | **Responsive split view**: canvas + property panel + toggleable live preview; tablet-capable; <768px shows "not supported" banner |
| Docs home | **docs/ tree** — `docs/product/` (plan-product) + `docs/specs/YYYY-MM-DD-HHMM-slug/` (shape-spec); root docs + `.agent-os/product` marked superseded |

## Ecosystem facts (verified 2026-07-09)

- `@getodk/web-forms` **1.0.0** (2026-07-03; local is 0.14.0). Peer `vue ^3.5.29`. Bundles PrimeVue **4.3.3** + `@primeuix/themes` 1.0.3 + primeflex internally; **all CSS injected by JS** (no .css file). Exports `OdkWebForm`, `webFormsPlugin`, `POST_SUBMIT__NEW_INSTANCE`. Props: `formXml`, `fetchFormAttachment` (host resolves attachments — our IndexedDB), `missingResourceBehavior`, `editInstance`, etc. Event `submit(payload, callback)`. Its `webFormsPlugin.install` prepends a **global CSS reset** (Roboto body font `!important`, element resets) and injects `:root { --odk-*, --p-* }` tokens.
- **No JS XLSForm→XForm converter exists anywhere** — ours is new code. pyxform 4.5.0 (Python) is the reference; goldens generated via `uvx --from pyxform xls2xform`.
- xlsx libs: **SheetJS CE 0.20.3** for reading (only via `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` — npm registry is stale at 0.18.5); **write-excel-file 4.1.1** for writing (MIT, maintained, multi-sheet).
- Targets: vue 3.5.39, vite 8.1.4, @vitejs/plugin-vue 6.0.7, vitest 4.1.10, **TypeScript ~5.9.3** (NOT 7.x — vue-tsc 3.3.7 compat unverified; ODK pins 5.9), pinia 3.0.4, vue-router 4, eslint 10.6.0 + neostandard 0.13.0, @vue/test-utils 2.4.11, @playwright/test 1.61.1, jszip 3.10.1, dexie 4.4.4, @xmldom/xmldom (test-only DOMParser), fake-indexeddb, fast-check, @fontsource/roboto.
- Remove: standalone `primevue`/`@primeuix/themes`/`primeflex`/`primeicons` deps get **pinned to exactly what web-forms bundles** (4.3.3/1.0.3) — see PrimeVue strategy; remove `ramda`, `@types/ramda`, the web-forms peerDependency entry, cssnano/postcss extras unless needed.

## Architecture (summary of the two design plans)

### Core (`src/core/` — pure TS, no Vue/Dexie imports, ≥90% coverage)

- **Model** (`src/core/model/types.ts`): canonical **tree** (`FormDocument` → `FormNode = QuestionNode | GroupNode | RepeatNode`), document-level `choiceLists` (shared by name), `settings`, `entities`, `languages`, `attachments` (refs only; Blobs in IndexedDB). `LocalizedText` keyed by the full XLSForm language string (`'English (en)'` — byte-identical to itext `@lang`), `'default'` sentinel for plain columns. **Lossless escape hatches everywhere**: `bind.custom`/`body.custom`/`instanceAttrs`/`customColumns`/`unknown.xformFragments`/`unknown.extraSheets` so import→export round-trips never lose data. Expressions stored in `${field}` form; raw XPath passes through unchanged.
- **Registry** (`src/core/registry/`): port `src/components/field-type-registry.ts` (the prototype's best asset) and extend with per-type XForm mapping (bind type, body element, mediatype, `jr:preload`/`jr:preloadParams`) + XLSForm token aliases. Metadata preloads (start/end/today/deviceid/username/audit/…) become proper preload binds — fixing the prototype.
- **Expression module** (`src/core/expr/`): tokenizer (string-literal aware), symbol table (name → absolute path, group/repeat nesting), `${}`→XPath (modes: bind / itemset-predicate / output; relative `../` within same repeat, `current()/` anchoring in predicates), conservative XPath→`${}` reverse (only on unambiguous names), `extractRefs` for validation.
- **XForm serializer** (`src/core/xform/serializer/`): deterministic own `XmlNode` writer (byte-stable across browser/Node for golden tests). pyxform-parity element ordering; itext policy = itext when languages/media/guidance exist, else inline; pyxform text-id scheme; selects always as secondary instance + `<itemset>` (choice_filter → predicate; `*_from_file` → `jr://file-csv/...`); dynamic defaults → `<setvalue odk-instance-first-load>`, `trigger` → `xforms-value-changed`; entities namespace/meta block; repeat `jr:count` + generated `_count` bind.
- **XForm parser** (`src/core/xform/parser/`): namespace-aware (localName, never prefix matching); instance walk → skeleton; bind/body folding with reverse type inference (preloads, mediatype, trigger→acknowledge); itext folding to `LocalizedText`; inline `<item>` legacy lists synthesized into choice lists; unrecognized model content preserved verbatim.
- **XLSForm reader** (`src/core/xlsform/reader.ts`): SheetJS behind a one-file adapter; case-insensitive sheets; header parsing with `::Language (code)` suffixes + pyxform column aliases; `begin_/end_` stack machine; **every issue carries `{sheet, row (1-based), column}`**; force-text cell coercion (never corrupt `version`/`007` values); unknown sheets/columns preserved.
- **XLSForm writer** (`src/core/xlsform/writer.ts`): write-excel-file; canonical ordered column set filtered to used columns; translated columns expand per language; DFS rows with begin/end markers; stable ordering → write→read round-trip equality.
- **ZIP exporter** (`src/core/export/zip.ts`): jszip; `form.xml` + `media/<filename>`; warn on missing blobs.
- **Validation** (`src/core/validate/`): pure validators (names, refs/lists/attachments, expression sanity, translations completeness, choices, entities) → `Issue[]` with severity; store recomputes debounced; **errors gate preview, warnings don't**.

### App (`src/` — Vue)

- **PrimeVue strategy (load-bearing)**: host pins **exactly** `primevue@4.3.3` + `@primeuix/themes@1.0.3` with a preset byte-identical to web-forms' (Aura + ODK blue `#3e9fcc` primary scale + slate surfaces, `darkModeSelector: false`, **no cssLayer**). **Never install `webFormsPlugin` on the host app** — `PreviewHost.vue` mounts `OdkWebForm` in a **dedicated child Vue app** (lazy-imported chunk, destroy/recreate to remount, app-level `errorHandler` as error boundary). `scripts/verify-webforms-bundle.mjs` + a theme-parity vitest guard against drift on web-forms upgrades. Re-verify bundle findings against 1.0.0 in Spec 01.
- **Styling**: `src/styles/odk-tokens.css` (copied `--odk-*` block so the app looks ODK before the preview chunk loads), `odk-preset.ts`, `builder.css` (`--builder-*` derived from tokens), @fontsource/roboto. Dark mode explicitly out of scope (web-forms is light-only).
- **Routes** (vue-router, hash history): `/` FormLibraryView (IndexedDB list, create/import/duplicate/delete), `/forms/:formId` FormEditorView, `/forms/:formId/preview` FullPreviewView. Everything else = panels (palette, canvas tree, properties, docked preview) or dialogs (Settings, Translations, Choice Lists, Attachments, Import + row-level ImportReport, Export, Submission Result, Restore Draft).
- **Canvas**: simplified **summary cards** (`TreeNodeCard.vue` — icon, type chip, name, label in display language, badges for required/relevant/constraint/calc/appearance/list/children), NOT widget mocks (drop `GenericFieldRenderer.vue` — the real preview is one panel over). Groups/repeats = bordered collapsible containers (blue/orange accent, kept from prototype).
- **DnD**: `vue-draggable-plus` (nested containers, palette clone, touch) + a **keyboard command layer** (Alt+arrows move/indent via `moveNode()`) that doubles as the deterministic e2e path. Click/Enter on palette inserts after selection.
- **Stores** (pinia): `useFormStore` (doc, single `mutate(label, fn)` gateway, memory undo/redo with coalescing, issues), `useWorkspaceStore` (library via Dexie `liveQuery`, import/export dispatch), `usePreviewStore` (500ms-debounced serialize, gated on zero errors, last-good-XML kept under an error banner, `fetchFormAttachment` backed by attachments + on-the-fly `itemsets.csv`), `useEditorStore` (selection, expanded, dialogs, panel sizes), `useUiStore`.
- **Persistence** (`src/persistence/`, dexie): `forms` / `attachments` (Blobs) / `snapshots` tables; autosave 1.5s debounce; snapshots on open/import/every 10min dirty (keep 20); undo memory-only; `schemaVersion` + `migrateDoc()`; SaveIndicator (saved/saving/dirty/error), crash-restore prompt, `beforeunload` guard.
- **Hard-part UX**: shared choice lists first-class with "used by N" warnings; CascadeEditor generating `choice_filter` (raw expression in advanced mode); maximized TranslationsDialog with virtualized per-language grid + completeness meter + canvas display-language switcher; `ExpressionInput` with `${` autocomplete from symbol table + inline validation + Problems popover (click-to-navigate).
- **Import/export UX**: drop zone + picker (.xml/.xlsx sniffed), progress for the 591KB template, severity-tagged row-level ImportReport (errors block, warnings allow "Import anyway"); Export SplitButton (XML default; XLSForm; ZIP), filenames from form_id+version.
- **Preview submit-testing**: `onSubmit` → SubmissionResultDialog (pretty instance XML, copy/download, "New instance" via `POST_SUBMIT__NEW_INSTANCE`). Language switching happens inside the preview (web-forms has no external language prop) — documented in UI copy.

## Work breakdown — 8 specs (each gets a `docs/specs/` folder per shape-spec conventions)

Every spec execution: (1) create `docs/specs/<timestamp>-<slug>/` with plan.md (full copy), shape.md, standards.md, references.md, user-guide.md; (2) implement with tests; (3) run lint + typecheck + vitest (+ e2e where present); (4) **verify in a real browser with the agent-browser skill** against the spec's checklist (`docs/verification/<spec>.md`); (5) commit on `development`.

1. **Spec 01 — Product docs & foundation** (~3-4d)
   Run `plan-product` skill → `docs/product/` (mission, roadmap, tech-stack reflecting client-side-only direction); mark PRODUCT_PLAN.md/REQUIREMENTS.md/TECHNICAL_SPECIFICATION.md/.agent-os/product as superseded (banner note, keep for history). Fresh scaffold: new package.json (deps above), vite 8, strict TS 5.9 + vue-tsc in build, eslint 10/neostandard, vitest + playwright scaffolds, `pnpm test`/`typecheck` scripts. Delete dead files (`builder.html.backup`, `src/legacy-styles/`, `src/styles/app.css`, starter assets). Move fixtures to `tests/fixtures/`. Core model + ops + factory + ids; registry port/extension; styling tokens/preset/builder.css; App shell, router, AppHeader/EditorLayout; Dexie schema + repos + autosave; workspace/form stores; FormLibraryView; theme-parity test + `scripts/verify-webforms-bundle.mjs` (re-verify 1.0.0 bundle).
   *Verify: app boots ODK-styled, create/rename/delete forms, survives reload.*

2. **Spec 02 — Expression engine & validation** (~2-3d)
   `src/core/expr/*` (tokenizer, symbol table, to-xpath 3 modes, from-xpath, extractRefs) + `src/core/validate/*` + store wiring (`issuesByNode`). Table-driven + property tests (fast-check: `from(to(e)) === e`).

3. **Spec 03 — Builder editor UI** (~4-5d)
   QuestionPalette, QuestionTree/TreeNodeCard, vue-draggable-plus + keyboard moves, selection, undo/redo toolbar + shortcuts, PropertyPanel with all sections (Basic/Appearance/Logic/Choices-stub/Repeat/Media), ExpressionInput + autocomplete, Problems popover. Component tests.
   *Verify: build a nested form with keyboard only; drag from palette into a group.*

4. **Spec 04 — XForm serializer & live preview** (~4-5d)
   Full serializer (instance/binds/itext/body/secondary instances/setvalue/entities) + snapshot tests + first pyxform goldens. `webFormsLoader` lazy chunk, PreviewHost child-app, PreviewPanel + FullPreviewView, preview store debounce/error-banner, `fetchFormAttachment`, SubmissionResultDialog.
   *Verify: label edit reflects in preview ≤1s; broken expression shows banner over stale preview; fill & submit shows instance XML.*

5. **Spec 05 — Choices, cascades & translations** (~3-4d)
   ChoiceListEditor/ManagerDialog, CascadeEditor (`choice_filter`), TranslationsDialog + virtualized grid, canvas language switcher, itext/randomize/seed serializer completion.
   *Verify: cascade filters live in preview; added language appears in preview dropdown.*

6. **Spec 06 — XForm import** (~3-4d)
   Parser (+ itext folding, reverse `${}` rewrite, unknown preservation), ImportDialog for .xml, round-trip suite (`all-widgets.xml`: 73 binds, itemset, image choices, French translation).
   *Verify: import all-widgets.xml → tree populated → preview renders → export → reimport equality.*

7. **Spec 07 — XLSForm import/export, ZIP & attachments** (~4-5d)
   Reader (row-numbered issues) + writer (stable columns, write→read round-trip) + zip exporter + AttachmentsDialog + FormSettingsDialog + ImportReport + ExportMenu/useDownload.
   *Verify: import the 591KB "ODK XLSForm Template.xlsx" cleanly; export ZIP and inspect contents.*

8. **Spec 08 — Hardening & release readiness** (~3-4d)
   Full Playwright suite (roundtrip, xlsform-import, persistence, preview-logic cascade/relevance, translations, all-widgets), golden matrix vs pyxform (~10 forms, documented divergence allowlist), coverage gates (core ≥90%/85%, stores ≥80%), a11y pass (roving tabindex tree, aria-live, focus rings), tablet drawer layout, performance (virtualized tree >200 nodes, auto-refresh threshold), agent-browser full checklist, README + user docs.

Total ≈ 26-34 dev-days equivalent. Dependencies: 01→02→03→04; 05/06/07 after 04 (06/07 parallelizable); 08 last.

## Test & verification strategy

- **Vitest**: node env for `src/core` (xmldom via `parseXml()` indirection), happy-dom for component tests; fake-indexeddb for persistence; fast-check property tests (model ops invariants, expr round-trip, doc round-trips); golden files vs pinned pyxform under `tests/golden/` with regeneration script documented.
- **Playwright**: chromium + firefox against `vite preview`; `window.__testHooks` only under `VITE_E2E=1`; keyboard path for DnD determinism.
- **agent-browser**: per-spec manual verification checklists in `docs/verification/`, incl. pointer-path drag, visual ODK-look comparison against a web-forms screenshot, 1280×800 + tablet viewport, keyboard-only session, export-download checks.
- CI order (scripts now, GitHub Actions later): lint → typecheck → unit/component → build → e2e.

## Risks & mitigations (top)

1. **pyxform behavioral divergence** → golden tests are the contract; divergences allowlisted, never silent; riskiest areas (entities, setvalue placement, repeat paths) implemented after goldens exist.
2. **web-forms rejecting our XML** → pyxform-parity ≈ web-forms compatibility (it's their supported input); preview errors surface as banners, not crashes; e2e kitchen-sink form.
3. **PrimeVue double-instance drift** → exact version pin, identical preset, child-app isolation, theme-parity CI test.
4. **SheetJS CDN tarball supply chain** → pinned URL+integrity in lockfile; single-file adapter allows swap.
5. **Reverse `${}` rewrite ambiguity** → rewrite only unambiguous names; raw XPath is first-class everywhere.
6. **Preview perf on large forms** → debounce, gate on validity, keep-last-good, manual refresh above ~300 questions, lazy chunk.

## Key reference files

- `src/components/field-type-registry.ts` — port source for the registry (best prototype asset)
- `src/components/FieldInstance.ts` — tree helpers/name validation to port
- `node_modules/@getodk/web-forms/dist/index.js` — styling/integration ground truth (re-verify at 1.0.0)
- `test-forms/all-widgets.xml`, `test-forms/ODK XLSForm Template.xlsx` — canonical fixtures
- `xlsform-cheatsheet/*` — XLSForm column/type/appearance surface (note: survey.md/choices.md exported empty; reconstructed union documented in Spec 07 shape docs)
- https://getodk.github.io/xforms-spec/ , https://docs.getodk.org/ — specs
