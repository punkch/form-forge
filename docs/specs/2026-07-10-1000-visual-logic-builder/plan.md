# F8 — Visual Logic Builder — Plan

## Goal

Authors build `relevant` (skip logic) and `constraint` expressions with
field / operator / value rows and ALL/ANY groups — no XLSForm syntax — while
every expression the visual grammar can't represent keeps working untouched
in the existing raw `ExpressionInput`. Calculations stay expression-shaped
but gain an insert-only formula picker.

## Core (`src/core/expr/structured.ts`, pure)

- **Model.** `ConditionTree` = root `ConditionGroup { kind: 'group', join:
  'and' | 'or', items }`; items are `Condition`s or one level of nested
  groups (never deeper). `Condition` =
  - `Comparison { operand, op: = != < <= > >=, literal: number | string }`
  - `SelectedPred { operand, value: string, negated }`
  - `StringLengthPred { operand, op, value: number }`
  - `RegexPred { operand, pattern }` (grammar amendment so the constraint
    presets render visually)

  `operand` is `${field}` or `.` (self) on every variant — a superset of the
  shaped model (`string-length(${q}) > 3` from the cheatsheet parses too).
- **`parseStructured(expr): ConditionTree | null`** — a hand-rolled
  recursive-descent scanner (position-based, so string literals need no
  masking pass) recognizing exactly that grammar. Heterogeneous `and`/`or`
  within one group, nesting deeper than one level, arithmetic, function
  calls outside the four predicates, field-to-field comparisons,
  `instance()` lookups → `null` (raw mode).
- **`serializeStructured(tree): string`** — deterministic: single spaces,
  single-quoted literals (pyxform convention; double quotes only when the
  value contains `'`), nested groups always parenthesized, stable operator
  spelling. Canonical form: single-item groups join with `and`.
- **Tests first** (`structured.spec.ts`): unit table, golden classification
  of every cheatsheet expression (visual vs raw), byte-stable round-trip of
  the acceptance expression, and a fast-check property
  `parseStructured(serializeStructured(t)) ≡ t` over canonical trees.

## UI (`src/components/logic/`)

- **`ConditionBuilder.vue`** — Visual/Raw toggle per the CascadeEditor
  derived-mode pattern: parseable non-empty → visual; unparseable → raw with
  the Visual tab disabled (tooltip + inline note); empty → raw (keeps the
  familiar placeholder and the existing `expr-*` testids) with Visual one
  click away. Raw edits pin raw mode so the editor never flips mid-typing;
  raw mode embeds the existing `ExpressionInput` and never rewrites the
  expression. Rows + per-group ALL/ANY `SelectButton`s + add-condition /
  add-group affordances; constraint mode adds the "Common patterns" preset
  dropdown (numeric range, NANP phone / email / letters-only regexes from
  the cheatsheet) that replaces the tree.
- **`ConditionRow.vue`** — field select from the form's questions (plus
  `.` "This answer" for constraints); operator list adapts to the field's
  bind type (selects: includes / doesn't include; numeric & date: ordered
  comparisons; text: comparisons + length + matches pattern); value widget
  adapts too (DatePicker for dates, choice dropdown for selects with an
  internal list, InputNumber for int/decimal, InputText otherwise).
  Unresolvable names degrade to text inputs — never to raw mode.
- **`CalculationHelper.vue`** — insert-only Select of four templates
  (arithmetic over two fields, `if(cond, a, b)`, `concat`, days between
  dates via `decimal-date-time`) pre-filled with real field names, inserted
  at the calculation input's cursor / replacing its selection.
- **`field-options.ts`** — shared field metadata (name, label, bind type,
  internal `listRef`) derived from the node tree + question-type registry.

## Wiring

`LogicSection.vue`: relevant + constraint render `ConditionBuilder` through
the exact same `setExpr` update path (undo labels unchanged); calculation
keeps `ExpressionInput` and gains `CalculationHelper`; constraint message,
repeat count and all `HelpPopover`s unchanged.

## Tests

- `tests/component/condition-builder.spec.ts` — mode derivation (parseable →
  visual, `instance()` → raw locked, empty → raw unlocked), row edits emit
  the re-serialized expression, choice dropdowns for selected(), degrade on
  unknown names, add/remove/group/preset flows, visual↔raw toggling never
  emits a rewrite, CalculationHelper templates.
- `tests/e2e/logic-builder.spec.ts` — build the acceptance expression
  `${age} >= 18 and (selected(${type}, 'refugee') or selected(${type},
  'idp'))` visually on a three-question form, verify the raw view shows it
  byte-identically, reload → still visual and identical, and the live
  preview actually hides/shows the dependent question as age/type change.
