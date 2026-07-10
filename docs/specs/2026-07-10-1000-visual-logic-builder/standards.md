# Standards — Visual Logic Builder

Follows the project standards from
`docs/specs/2026-07-09-1602-product-docs-and-foundation/standards.md`
(strict TypeScript, Composition API `<script setup>`, pure `src/core/`
modules with no Vue/Pinia imports, Vitest + Playwright patterns) and the
i18n conventions from `docs/specs/2026-07-09-2352-ui-i18n-foundation/`
(all UI strings through `t()`, keys in the namespace JSON).

Conventions this feature adds for future expression-UI work:

- **The structured grammar is the contract.** Any widget that wants to
  render an expression visually must go through
  `parseStructured`/`serializeStructured`; `null` means raw mode, full
  stop. Never write a second ad-hoc expression parser in a component.
- **Serialization must stay deterministic and canonical.** New condition
  kinds must round-trip through the fast-check property in
  `structured.spec.ts` (extend the generator with the new arm) and keep
  single-item groups on `join: 'and'`.
- **Raw mode is sacred.** Visual surfaces may only emit expressions the
  user built by editing rows; switching tabs must never emit. An expression
  the grammar rejects is displayed verbatim and only ever changed by the
  raw `ExpressionInput`.
- **Grammar growth = tests first.** Extend the golden classification table
  in `structured.spec.ts` (visual vs raw) before widening the parser, so
  every cheatsheet shape keeps an explicit expected classification.
- **Field typing comes from the registry.** Operator/value adaptation reads
  bind types via `field-options.ts` (question-type registry) — don't infer
  types from names or duplicate registry data in components.
- **Degrade, don't eject.** Unresolvable `${name}`s inside a parseable tree
  degrade that row to text inputs; forcing raw mode for a representable
  tree is a regression (covered by component test).
