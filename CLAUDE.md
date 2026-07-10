# CLAUDE.md — repository index

**Form Forge for ODK** — client-side-only Vue 3.5 SPA: a visual builder for ODK forms with a native
TypeScript XLSForm/XForm engine and a live `@getodk/web-forms` preview.
**No backend, no telemetry — everything stays in the browser.** Ships as
static files (GitHub Pages), installable as an offline PWA, embeddable in an
iframe via a postMessage API.

> **Keep this file up to date.** Whenever a feature is delivered, a module
> is added/moved, a convention changes, or a pin is bumped: update this
> index, the README Features section (✅/⬜), and `docs/product/roadmap.md`
> in the same change. This file is the entry point for future AI sessions —
> stale entries cost more than missing ones.

## Commands

```bash
pnpm dev / build / preview          # vite; BASE_PATH=/repo/ for sub-path builds
pnpm test                           # vitest: unit (node) + component (happy-dom)
pnpm test:e2e                       # playwright chromium+firefox vs built app on :4173
pnpm lint / typecheck               # eslint (neostandard + i18n rules) / vue-tsc
pnpm test:coverage                  # enforces floors: core 86/78/88, stores 80/85, persistence 90/92
uv run --with openpyxl --with pyxform scripts/make-goldens.py [fixture…]   # regen goldens (deliberate act)
pnpm exec tsx scripts/make-templates.ts                                    # regen bundled starter templates
```

## Hard invariants

- **`src/core/` is pure TS** — no Vue/Pinia/Dexie/vue-i18n imports, ever.
  Core emits `Issue`s with stable `code` strings (factories in
  `src/core/validate/issues.ts`). The English `message` is rendered
  verbatim in the UI (ProblemsButton, inline field errors); codes are used
  for filtering/grouping, not localization. e2e tests assert message
  substrings — don't reword existing messages casually.
- **Persistence goes through the backend seam** (`src/persistence/backend.ts`).
  Repos keep identical signatures across the Dexie default and the embed
  memory backend; specs run on both via `tests/helpers/backends.ts`.
- **Serializer behavior is pinned to pyxform 4.5.0** by `tests/golden/`
  (parity + parse→serialize round-trip gates auto-discover every fixture).
- **Version pins with reasons** (`docs/product/tech-stack.md`): PrimeVue
  4.3.3 + @primeuix exactly match what `@getodk/web-forms` bundles (byte-
  identical preset, `pnpm verify:webforms`); `xlsx` comes from the
  cdn.sheetjs.com tarball (npm copy is stale); TypeScript `<7` for vue-tsc.
- **UI strings only via vue-i18n** — typed per-namespace catalog in
  `src/i18n/locales/en/`, `useAppI18n()` in components, `translate` in
  stores; eslint `no-missing-keys` is an error. Keep rendered English
  byte-stable unless intentionally changing copy (tests assert strings).
- **Preserve `data-testid`s** — e2e helpers depend on them.
- **Conventional commits** — release-please derives versions from them;
  work on `development`, `main` is the release branch.

## Code map

| Path | What lives there |
| --- | --- |
| `src/core/model/` | FormDocument/FormNode types, factory (`newDocument`, `instantiateTemplate`), ops (`visit`, `flatten`, `cloneSubtree`), `migrateDoc`, display helpers |
| `src/core/registry/question-types.ts` | ~40 question types: XForm mapping, appearances, parameters, `docsAnchor`, `searchKeywords`, `effectiveItemsetFile` |
| `src/core/expr/` | `${field}`↔XPath rewriting, tokenizer, symbol table, `structured.ts` (visual-logic condition grammar, `trySerializeStructured` representability guard) |
| `src/core/xform/` | serializer + parser (lossless round-trip incl. entities dialect) |
| `src/core/xlsform/` | .xlsx reader/writer; `workbook-read.ts` is the ONLY module allowed to import `xlsx` (also `readCsvRows`) |
| `src/core/datasets/` | CSV/GeoJSON parsing for previews + column metadata (500-row cap) |
| `src/core/workspace/archive.ts` | `.formforge.zip` build/read (manifest + form.json + attachments) |
| `src/core/validate/` | validators (structure, refs, expr, parameters, translations, datasets, entities) + `Issue` factories |
| `src/core/util/guards.ts` | shared `isRecord`, `hasText` |
| `src/stores/` | `form` (doc, mutate/undo, autosave, datasetColumns), `workspace` (library), `preview` (debounced regen, reset-on-switch), `editor` (selection/dialogs), `ui` (persisted prefs incl. locale), `embed` |
| `src/composables/` | shared view logic: `useWorkspaceExport` (archive downloads), `useStoragePersistence`, `useEditingLanguage` (panel editing-language state), `useDownload`; app version helper in `src/version.ts` |
| `src/persistence/` | backend seam + Dexie impl (db v2: forms/attachments/snapshots/templates), memory backend, repos (`duplicateForm`, `createFormWithArchiveAttachments`, `remapAttachments`), `workspace-io`, `templates-repo` |
| `src/preview/` | web-forms loader (isolated child Vue app), `fetchFormAttachment` (jr:// → attachments by filename) |
| `src/embed/` | postMessage protocol v1 (types/guards), bridge (origin-pinned), detection; demo host `public/embed-demo.html` |
| `src/pwa/` | `updatePolicy.ts` (hybrid auto/prompt decision), `registerSW.ts`, persistent-storage request |
| `src/help/` | registry-driven help content map + shared type search (`groupTypesBySearch`) |
| `src/i18n/` | createI18n setup, typed `MessageSchema`, `setLocale` (lang/dir for future RTL), per-namespace `locales/en/*.json` |
| `src/templates/` | bundled starter FormDocument JSONs + lazy registry (regenerate via `scripts/make-templates.ts`) |
| `src/components/` | UI by area: palette, canvas, properties (+ `logic/` ConditionBuilder, EntitySection), preview, choices, translations, importexport (+ FileDropzone), attachments, datasets, help, library, settings, shell |
| `src/views/` | FormLibraryView, FormEditorView (resizable grid shell), FullPreviewView, SettingsView (#/settings: workspace io, UI language, About; blocked in embed), EmbedWaitingView |
| `tests/` | `unit/` + co-located `*.spec.ts`, `component/` (happy-dom), `e2e/` (playwright; helpers.ts), `golden/` (pyxform parity), `helpers/` (doc-builders, xml-canonicalize, backends) |
| `.github/` | `ci.yml` (quality ∥ e2e), `release-please.yml` (main), `deploy.yml` (Pages, e2e-gated), composite setup action |

## Documentation index

- `docs/product/` — mission, roadmap (Phase 1 + delivered Phase 2 + pending
  Phase 3), tech-stack (pins + rationale).
- `docs/specs/<YYYY-MM-DD-HHMM-slug>/` — one folder per delivered work
  package: `plan.md` (full), `shape.md` (scope/decisions), `references.md`,
  `standards.md`, `user-guide.md`. Notable user guides: **ci-cd-github-pages**
  (release/Pages setup, Release-As v1.0.0 bootstrap — never put `release-as`
  in release-please-config.json, it sticks) and **embed-postmessage-api**
  (host integration).
- `docs/specs/backlog/` — pending proposals only (central-publishing
  [publish + import + multi-server], in-app-guidance). Delivered shaping
  docs live in git history.
- `docs/verification/` — agent-browser manual pass logs + screenshots per
  feature.
- `tests/golden/README.md` — golden regeneration policy (pyxform 4.5.0).

## Delivery process (established with the user)

New significant work: shape it in `docs/specs/backlog/` → promote to a
timestamped spec folder (shape-spec layout above) as implementation starts →
implement via dynamic Workflows with parallel agents → verify (full suite +
agent-browser pass logged to `docs/verification/`) → run `/code-review`
(five lenses, no plan mode) and fix findings immediately → conventional
commit per feature → update README Features, roadmap, and THIS file.
