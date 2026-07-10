# F9 — Entities Advanced — Plan

## Problem

Spec 04 shipped entity **creation** with pyxform parity. The update path
(`update_if` / `entity_id` / version pointers) was implemented from spec
reading but never golden-pinned, `save_to` had no UI at all, and nothing
helped authors build the standard "follow-up form" pattern (select an
entity from `<dataset>.csv`, update it).

## Design

### 1. Goldens first (`scripts/make-goldens.py`, `tests/golden/`)

Two new fixtures, regenerated with pinned pyxform:

- `entities_update` — entities sheet with `list_name`, `label`,
  `update_if`, `entity_id`; no consuming select (pins the dangling
  `instance()` reference pyxform emits).
- `entities_follow_up` — `select_one_from_file households.csv` +
  `update_if: true()` + `entity_id: ${household}` (pins the
  no-label entity element and the consuming-select flow).

Mirrored in `golden.spec.ts` via the existing `doc()`/`q()` builders (no
builder extension needed — `entities` and `saveTo` were already
supported). `xlsform-bridge.spec.ts` count assertion 8 → 10.

### 2. Serializer (`src/core/xform/serializer.ts`, entity paths)

- `buildMeta`: `create`/`update` become static `"1"`;
  update adds `baseVersion`/`trunkVersion`/`branchId` empty attributes.
- `buildModelBindsAndActions`: emits (in pyxform order) the `@create`
  calculate bind (when `create_if` set), `@update` calculate bind (when
  `update_if` set), three version-pointer calculate binds
  (`instance('<dataset>')/root/item[name=<id>]/__version|__trunkVersion|__branchId`),
  then `@id` — calculate form for update, bind+`uuid()` setvalue for
  create. `ENTITIES_VERSION` stays the single `2024.1.0` constant
  (verified: pyxform 4.5.0 has no per-flow gate).

### 3. Parser (`src/core/xform/parser.ts`, entity block only)

Captures `@create`/`@update`/`@id` bind calculates, skips the derived
version-pointer binds, and prefers bind calculates over legacy inline
attribute expressions. Required because `roundtrip.spec.ts` gates every
golden through parse → serialize equality.

### 4. Validation (`src/core/validate/entities.ts` + spec)

New rules (severities match pyxform behavior, probed):

| code | severity | rule |
|---|---|---|
| `entities.reserved-save-to` | error | `save_to` is `name`/`label`, case-insensitive |
| `entities.invalid-save-to` | error | `save_to` fails `NAME_RE` |
| `entities.duplicate-save-to` | error | property already saved by an earlier question (later question flagged) |
| `entities.follow-up-no-source` | warning | `entity_id` set but nothing selects from `<dataset>.csv` |
| `entities.dataset-file-mismatch` | warning | `entity_id` references a `*_from_file` select reading a different file |

`save_to` checks run even without a declaration (refs.ts already errors
`entities.saveto-without-declaration` separately). Existing five rules
kept byte-identical in behavior.

### 5. Settings dialog (`FormSettingsDialog.vue`)

PrimeVue `Tabs`: **General** (unchanged fields/testids) | **Entities**:

- empty state → `entity-declare` button creates `{ datasetName: '' }`;
- declaration editor: dataset name `InputText`
  (`entity-dataset-name`), label / create_if / update_if / entity_id via
  `ExpressionInput` (testids `expr-entityLabel`, `expr-createIf`,
  `expr-updateIf`, `expr-entityId`) with the shared symbol-table
  autocomplete; declaration-scoped issues render inline
  (`entity-issue`);
- save_to overview table (`entity-save-to-table` / `entity-save-to-row`):
  question name → property; clicking a row selects + reveals the question
  (editor store `select` + `revealNodeId`) and closes the dialog;
- `entity-follow-up` wizard button (single `mutate` = single undo step):
  adds `select_one_from_file <dataset>.csv` named after the dataset at the
  top of the form, sets `entityId` to `${<name>}` and defaults `updateIf`
  to `true()`; confirmation line `entity-follow-up-done`;
- `entity-remove` deletes the declaration.

### 6. Property panel (`EntitySection.vue`, wired after Logic)

Rendered only when `doc.entities !== undefined` and `canSaveTo(node,
def)`. One `save_to` input (`prop-save-to`) with the staged
`HelpPopover field="saveTo"`, a dataset hint when valid, and inline
`entities.*` issue display (`save-to-issue`).

### 7. Tests

- `src/core/validate/entities.spec.ts` — unit coverage of every rule.
- `tests/component/entities.spec.ts` — section gating (including notes),
  saveTo editing/clearing, inline issue display, staged help popover,
  tab preservation of General testids, declare/remove, single-undo-step
  wizard, overview-row navigation.
- `tests/e2e/entities.spec.ts` — declare → reserved save_to in Problems →
  fix → XLSForm export read back node-side with `readXlsForm` (entities
  sheet round-trip asserted); wizard wiring + preview non-crash (GO
  verdict recorded in shape.md).

## Verification

`pnpm vitest run tests/golden/ src/core tests/component` (all green),
`pnpm typecheck`, eslint on changed files,
`pnpm exec playwright test tests/e2e/entities.spec.ts --project=chromium`
(2 passed).
