# Visual logic builder — shaping (backlog)

## Problem

Relevance, constraints and calculations are the single biggest usability
cliff for non-technical authors. Today they type raw XLSForm expressions
(with `${}` autocomplete and balance checking, but still syntax). The
product mission promises form logic without expression knowledge.

## Scope

- A **structured condition editor** for `relevant` and `constraint`:
  rows of *field / operator / value*, combined with ALL/ANY (and/or)
  groups, one level of nesting.
- A **calculation helper** for the common shapes: arithmetic over fields,
  `if(cond, a, b)`, `concat`, date arithmetic — as guided pickers.
- **Two-way**: expressions that fit the visual grammar open visually;
  anything else opens in the existing raw `ExpressionInput`. Never destroy
  an expression the visual mode can't represent.

## Approach

The pattern is already proven in-house: Spec 05's CascadeEditor derives
"visual vs raw" from whether the current expression matches a recognizable
grammar. Scale that up:

- `src/core/expr/structured.ts`:
  - `parseStructured(expr): ConditionTree | null` — a small recursive-
    descent parser over the existing tokenizer (`maskStringLiterals`,
    `findRefs`) recognizing exactly the grammar the UI can build:
    `operand op literal` with operands `${field}` | `.`, ops
    `= != < <= > >= selected(x, v) not(selected(x, v)) string-length(.)`,
    joined by homogeneous `and`/`or` within a group, groups parenthesized.
    Returns `null` on anything else (raw mode).
  - `serializeStructured(tree): string` — deterministic emission so
    visual → save → reopen is stable.
  - Property test: `parseStructured(serializeStructured(t))` round-trips.
- Field pickers use the existing symbol table (typed: the registry knows
  each field's bind type, so operator/value widgets adapt — date pickers
  for date fields, choice dropdowns when the referenced field is a select
  with an internal list).
- UI `src/components/logic/ConditionBuilder.vue` replaces the bare
  textarea in `LogicSection.vue` behind a Visual/Raw toggle; raw mode is
  and stays the escape hatch (round-trips losslessly by definition).
- Constraint editor gets a curated "common patterns" dropdown (numeric
  range, regex presets from the cheatsheet: phone, email, letters-only)
  that fills the rows.

## Decisions (proposed)

- One nesting level in v1 (ALL of [ANY of […]]) — covers the vast
  majority of real forms; the tree model allows deeper later.
- No visual editing for `calculation` beyond the helper templates in v1;
  calculations are inherently expression-shaped.

## Open questions

- Should the builder *write* `${}` or plain names in `selected()` values?
  (Follow pyxform examples: quoted literals.)
- Usability review needed on how ALL/ANY groups read for non-technical
  users — prototype with 2–3 target users before building the full grid.

## Acceptance

`${age} >= 18 and (selected(${type}, 'refugee') or selected(${type},
'idp'))` opens visually, edits, and re-serializes stably; an
`instance()` lookup opens in raw mode untouched; golden expressions from
the cheatsheet tables all classify correctly (visual vs raw).
