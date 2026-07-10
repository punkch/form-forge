# F2 — Form Templates & Starter Gallery — Plan

## Goal

Let a new user start from a realistic instrument instead of an empty canvas,
and let any user turn a form they built into a reusable local template —
all client-side.

## Core (model layer)

### `src/core/model/factory.ts`

`instantiateTemplate(template: FormDocument, title: string): FormDocument` —
`structuredClone` the template (templates are plain data: bundled JSON or
Dexie records), walk every node with `visit` minting fresh `newId()`s,
reset `settings.formTitle`/`formId` (slugified)/`version` (default stamp),
drop `attachments`. Everything else (names, labels, languages, choice
lists, logic, other settings) is preserved.

## Bundled templates

### `scripts/make-templates.ts`

Deterministic generator: builds the four starters with
`newDocument`/`createNode`/`insertNode`, stamps sequential node ids,
asserts `validateDocument` has 0 errors and `serializeXForm` 0 error
issues, writes `src/templates/<slug>.json`.
`tests/unit/templates-generator.spec.ts` verifies byte-parity with the
checked-in JSON (and regenerates when `REGENERATE_TEMPLATES=1`).

Templates (bilingual `English (en)` + `French (fr)`, defaultLanguage EN):

| slug | questions | notable content |
|---|---|---|
| household-survey | 13 | member repeat, geopoint, constraints |
| individual-registration | 11 | consent select, `. <= today()` constraint |
| site-monitoring-visit | 13 | conditional issues/follow-up questions |
| feedback-satisfaction | 10 | satisfaction scales, conditional reason |

### `src/templates/index.ts`

`bundledTemplates: BundledTemplate[]` registry — `{ id, titleKey,
descriptionKey, tags, questionCount, preview, load }`. `load()` lazily
imports the JSON chunk through a `migrateDoc` gate (throws on a malformed
artifact). Titles/descriptions are `library.templates.*` catalog keys;
`questionCount`/`preview` are precomputed and cross-checked by
`tests/unit/templates-registry.spec.ts`.

## Persistence

### `src/persistence/db.ts`

Schema v2: `templates: 'id, updatedAt, title'` (v1 stores carry over).
`TemplateRecord { id, title, description, questionCount, preview,
createdAt, updatedAt, doc }`. Constructor accepts `DexieOptions` so the
upgrade spec can inject an isolated `IDBFactory`.

### `src/persistence/templates-repo.ts`

`listTemplates` (newest first), `addTemplate(doc, title, description)`
(JSON-round-trip clone → strip attachments → precompute `countQuestions` +
`templatePreview` = first 5 non-empty question labels via
`flatten`/`displayText`), `deleteTemplate`. Spec includes a real v1→v2
upgrade test (open a v1-shaped db first, then open `BuilderDb` over it).

## Stores & UI

### `src/stores/workspace.ts`

`createFormFromTemplate(doc, title)` =
`formsRepo.createForm(instantiateTemplate(doc, title))`.

### `src/components/library/NewFormDialog.vue` (new)

Extracts the inline "New form" dialog. Phase 1 (gallery): blank card
(`new-form-blank`), bundled cards (`new-form-template-<id>`), local cards
(`new-form-local-template` with `Local` tag, open + delete buttons) — plus
the title field, so blank creation keeps today's exact flow. Phase 2
(confirm): back button (`new-form-back`), selected-template summary, title
prefilled. `new-form-title`/`new-form-create` testids preserved. Emits
`created(record)`; the view navigates.

### `src/views/FormLibraryView.vue`

Swaps the inline dialog for `NewFormDialog`; row menu gains "Save as
template" → small dialog (name prefilled with the form title, description,
attachments-not-included note) → `templatesRepo.addTemplate`.

## Tests

- `src/core/model/factory.spec.ts` — fresh ids at all depths, source
  independence, settings reset.
- `src/persistence/templates-repo.spec.ts` — strip/precompute, ordering,
  delete, v1→v2 upgrade.
- `tests/unit/templates-generator.spec.ts` — build validity, 8–15 question
  range, JSON byte-parity.
- `tests/unit/templates-registry.spec.ts` — every bundled template loads,
  migrates, validates (0 errors), instantiates (0 errors), honest metadata.
- `tests/component/new-form-dialog.spec.ts` — gallery contents, blank path,
  bundled path (calls `createFormFromTemplate`), local path + delete.
- `tests/e2e/templates.spec.ts` — new-from-template → expected canvas node
  count, zero problems, engine preview; save-as-template → reload →
  gallery → instantiate.
