# F8 — Visual Logic Builder — Shaping Notes

## Scope

Implements `docs/specs/backlog/visual-logic-builder.md` with one agreed
amendment: the structured grammar ALSO recognizes `regex(operand,
'pattern')` predicates, so the constraint presets (phone / email /
letters-only) open and edit visually instead of falling back to raw.

## Decisions

- **Derived mode, scaled up from CascadeEditor.** Whether the builder shows
  rows or the raw textarea is computed from the expression itself
  (`parseStructured` result), not stored. The only state is the user's
  explicit tab choice, and editing raw text pins raw mode so the editor
  can never flip to visual under a typing user (typing `. >= 0` would
  otherwise yank the textarea away the instant it parses).
- **Empty expressions open in raw mode with Visual enabled** — a deliberate
  refinement of "visual when parseable". An empty tree has nothing visual
  to show, the raw placeholder (`e.g. ${age} >= 18`) is the established
  affordance, and — decisively — the existing e2e/component contracts
  (`preview.spec.ts`, `editor.spec.ts`, `property-panel.spec.ts`) fill
  `expr-relevant` / `expr-constraint` directly on freshly created questions.
  Visual is one click away and immediately parseable expressions reopen
  visually forever after.
- **Scanner, not masked regexes.** `parseStructured` is a position-based
  recursive-descent scanner; string literals are consumed by quote position
  (XPath 1.0 strings have no escapes), so `maskStringLiterals` isn't needed
  inside the parser. The grammar functions (`selected`, `not`,
  `string-length`, `regex`) are matched as call tokens; everything else
  falls through to `operand op literal`.
- **`operand` on every predicate.** The shaped model had `StringLengthPred
  { op, value }` and `RegexPred { pattern }` (self-only). The cheatsheet's
  own relevance table uses `string-length(${q1}) > 3`, so all four condition
  kinds carry an `operand: ${field} | .` — a strict superset that lets one
  row component render everything.
- **Canonical trees.** A group with a single item serializes without its
  joiner, so parse cannot recover `or` there; single-item groups are
  canonically `join: 'and'` (enforced on emit, assumed by the fast-check
  generator). `selected(${q}, -88)` parses (value coerced to string) but
  re-serializes quoted — semantically identical, and the golden test pins
  the classification rather than byte-stability for that one shape.
- **Never destroy.** Visual mode only ever *re-serializes an edited tree*;
  toggling tabs emits nothing (component test asserts no
  `update:modelValue`). Unresolvable field names degrade the row's widgets
  to plain text inputs instead of ejecting the whole tree to raw.
- **Representability guard.** XPath 1.0 has no string escaping and no
  exponent literals, so two literal classes can't be serialized: a string
  containing *both* `'` and `"`, and a number whose only spelling needs an
  exponent. `serializeStructured` gained a `trySerializeStructured` sibling
  that returns `null` for such trees; numbers are expanded to plain decimals
  (`1e-7` → `0.0000001`) so in practice only dual-quote strings trip it.
  When a visual edit would produce an unrepresentable tree, `ConditionBuilder`
  **keeps the last good expression** (emits nothing, so the offending
  keystroke visually reverts) and shows an inline hint
  (`properties.logic.unrepresentable`) pointing the author at the Raw editor —
  which is always reachable because the saved expression stays representable.
  Chosen over blocking the keystroke at the input because it needs no
  per-widget interception and reads clearly for the rare case it guards.
- **Same update path.** `ConditionBuilder` emits `update:modelValue` into
  the pre-existing `setExpr` handlers in `LogicSection`, so undo labels,
  coalescing and validation wiring are untouched. In raw mode the embedded
  `ExpressionInput` keeps its `expr-relevant` / `expr-constraint` testids.
- **Calculations stay raw** (backlog decision) — `CalculationHelper` is
  insert-only: it never parses the calculation, it just drops a template at
  the cursor of the `expr-calculation` textarea (or appends when the
  element isn't reachable), pre-filled with the form's own field names
  (numeric fields for arithmetic, date fields for the date-difference
  template, `decimal-date-time` per ODK convention).
- **Preset regexes are the cheatsheet's own** (NANP phone, pragmatic email,
  letters-only) — realistic ODK-compatible patterns, not invented ones.

## Verification

- 50 unit tests incl. the fast-check round-trip property (500 runs) and the
  golden classification table (`pnpm vitest run src/core/expr/structured.spec.ts`).
- 19 component tests (`tests/component/condition-builder.spec.ts`).
- New e2e (`tests/e2e/logic-builder.spec.ts`, chromium-verified): acceptance
  expression built visually → raw view byte-identical → reload reopens
  visual → live preview skip logic reacts to age/type answers.
- Existing `preview.spec.ts` / `editor.spec.ts` re-run green (they exercise
  the raw-by-default empty state); full vitest suite green; vue-tsc and
  ESLint clean.

## Out of scope (follow-ups)

- Deeper nesting (the tree model already allows it; the parser enforces one
  level for v1).
- Visual editing of `required` conditions and `repeat_count`.
- Usability pass on ALL/ANY wording with target users (backlog open
  question).
