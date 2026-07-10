# F9 — Entities Advanced (update flows, save_to UI, follow-up wizard) — Shaping Notes

## Scope

The `docs/specs/backlog/entities-advanced.md` slice: golden-pin the entity
**update** serialization path, extend entity validation (reserved/duplicate/
invalid `save_to`, follow-up consistency), add an **Entities** tab to the
form settings dialog (declaration editor + save_to overview + follow-up
wizard) and a per-question **Entity** property-panel section for `save_to`.

Out of scope (still backlog): dataset preview reuse for local entity-list
samples beyond what the existing attachment tooling already gives
(uploading `<dataset>.csv` to the consuming select works today), and an
`offlineSample?: AttachmentRef` model link.

## pyxform 4.5.0 findings (goldens first — the Spec 04 method)

Probed with `uv run --with openpyxl --with 'pyxform==4.5.0'` before any
serializer change. New goldens: `entities_update`, `entities_follow_up`.

- **`entities-version` is unconditionally `2024.1.0`** for create *and*
  update flows in pyxform 4.5.0 — no 2023.1.0 feature gate to reproduce.
  The backlog's open question is resolved: one constant, no conditional.
- **`create`/`update` entity attributes are static `"1"` markers.**
  Conditional expressions never live on the attribute; they are emitted as
  bind calculates on the attribute nodesets
  (`<bind nodeset=".../meta/entity/@create" calculate="…" readonly="true()"
  type="string"/>`, same for `@update`). Our serializer previously inlined
  the rewritten `create_if` into the attribute — fixed to match.
- **Update flows emit three offline-entities version pointers**:
  `baseVersion=""`, `trunkVersion=""`, `branchId=""` attributes, each with
  a bind
  `calculate="instance('<dataset>')/root/item[name= <entity_id expr> ]/__version|__trunkVersion|__branchId"`.
- **`@id` differs by flow**: create → bare readonly bind + a
  `<setvalue event="odk-instance-first-load" value="uuid()"/>`; update →
  the readonly bind carries `calculate="<entity_id expr>"` and there is
  **no setvalue**. Upsert (create_if + update_if + entity_id) uses the
  calculate form.
- **Bind order** (pinned by the goldens, element order matters to our
  canonicalizer): `@create`, `@update`, `@baseVersion`, `@trunkVersion`,
  `@branchId`, `@id` (+ create setvalue), `entity/label`.
- **pyxform emits a dangling `instance('<dataset>')` reference** when an
  update form has no `select_one_from_file <dataset>.csv`: the
  `entities_update` golden contains no secondary instance at all, yet the
  version binds reference it (Central attaches the entity list
  server-side). We reproduce this byte-for-byte and surface it to authors
  as the `entities.follow-up-no-source` warning instead of "fixing" the
  XML.
- **`entity_id` set with empty `update_if`** → `update="1"` and *no*
  `@update` bind (probe `probe_id_only`).
- **`save_to` validation in pyxform is errors, not warnings**: reserved
  `name`/`label` rejected **case-insensitively**; duplicates rejected
  ("already assigned by row N"); property names must match
  `^[A-Za-z_][A-Za-z0-9._-]*$` (identical to our `NAME_RE`). `save_to`
  inside a repeat is accepted by pyxform (no check on our side either).

## Spike: @getodk/web-forms 1.0.0 + entity-consuming preview — **GO**

Verdict from the e2e run (`tests/e2e/entities.spec.ts`, chromium):
`[entities spike] preview rendered=true entityListOptions=true`.

- The engine mounts the full 2024.1.0 update form (entity meta element,
  attribute-nodeset binds, version-pointer calculates) without error.
- `select_one_from_file households.csv` resolves through our
  `fetchFormAttachment` against the local IndexedDB attachment and shows
  the CSV's entity options ("House A"/"House B" render).
- A happy-dom spike was attempted first and is not viable: web-forms'
  tree-sitter XPath parser needs browser WASM loading (`__dirname` crash
  under node ESM), so engine checks must stay in Playwright.
- Fallback still asserted: the e2e accepts a contained
  `preview-error-state`/`preview-engine-error` (missingResourceBehavior
  'BLANK' path) and fails only on a dead page, so a future engine
  regression degrades instead of crashing the editor.

## Decisions

- **Parser learned the same dialect it serializes** (`src/core/xform/
  parser.ts`, entity block only): `@create`/`@update` bind calculates are
  captured into `createIf`/`updateIf`, `@id`'s calculate into `entityId`,
  and `@baseVersion`/`@trunkVersion`/`@branchId` binds are *dropped* (they
  are derived from `entityId` on export). Old-style inline attribute
  expressions still parse (back-compat with previously saved docs).
- **A bind calculate round-trips verbatim** — even `update_if: true()` —
  so parse → serialize reproduces pyxform byte-canonically; only the
  legacy inline `update="1"/"true()"` marker is treated as "no condition".
- **No model change**: `EntityDeclaration` and `saveTo` already carried
  everything; version pointers are derived state and never stored.
- **Validation severities follow pyxform**: reserved/invalid/duplicate
  `save_to` are errors; follow-up consistency
  (`entities.follow-up-no-source`) and `entities.dataset-file-mismatch`
  (entity_id sourced from a select reading a *different* file than
  `<dataset>.csv`) are warnings, because pyxform accepts those forms.
- **Follow-up wizard is one `form.mutate` call** (single undo step):
  insert `select_one_from_file` named `uniqueName(doc, dataset)` with
  `itemsetFile = <dataset>.csv` at index 0, set `entityId = ${name}` and
  default `updateIf = 'true()'` only when empty.
- **Entity property-panel section gating** (`canSaveTo`): questions whose
  bind carries a value — excludes notes (display), in-meta rows (audit)
  and `csv-external`; includes calculates (common save_to source).
- **Settings dialog gained PrimeVue Tabs**; the General tab preserves all
  pre-existing fields and testids unchanged.

## Risks / follow-ups

- `roundtrip.spec.ts` auto-discovers goldens, which forced the parser
  extension in this slice; the parser edit is tightly scoped to the entity
  meta block.
- The upsert flow (create_if + update_if + entity_id) is probe-verified
  but not golden-pinned; add an `entities_upsert` fixture if the UI ever
  promotes that pattern.
- Entity lists attached by Central carry `__version` etc.; local preview
  CSVs need those columns only for update flows to compute versions — the
  preview renders without them (BLANK behavior on the lookups).
