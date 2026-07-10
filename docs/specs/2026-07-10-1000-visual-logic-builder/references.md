# References — Visual Logic Builder

## Files added

- `src/core/expr/structured.ts` — ConditionTree model, `parseStructured`,
  `serializeStructured`, `emptyTree`.
- `src/core/expr/structured.spec.ts` — unit table, golden classification,
  fast-check round-trip property.
- `src/components/logic/ConditionBuilder.vue` — visual/raw builder for
  relevant + constraint (presets on constraint).
- `src/components/logic/ConditionRow.vue` — field / operator / value row.
- `src/components/logic/CalculationHelper.vue` — insert-only formula picker.
- `src/components/logic/field-options.ts` — field metadata for the pickers.
- `tests/component/condition-builder.spec.ts`
- `tests/e2e/logic-builder.spec.ts`

## Files changed

- `src/components/properties/LogicSection.vue` — relevant/constraint render
  `ConditionBuilder`; calculation gains `CalculationHelper`; update paths,
  undo labels and `HelpPopover`s unchanged.
- `src/i18n/locales/en/properties.json` — new `properties.logic.*` keys
  (modes, row labels, operators, presets, calc templates).

## In-repo foundations used

- `docs/specs/backlog/visual-logic-builder.md` — the shaped problem/approach
  this implements.
- `src/core/expr/tokenizer.ts` — grammar boundaries follow its scanner
  conventions (the structured parser is position-based for the same
  lossless-round-trip reasons).
- `src/core/expr/symbol-table.ts` + `src/core/model/index-utils.ts` — the
  typed name→node lookup pattern; the builder derives field bind types and
  internal `listRef`s the same way via the question-type registry.
- `src/components/choices/CascadeEditor.vue` — the proven visual-vs-raw
  derived-mode pattern this scales up.
- `src/components/properties/ExpressionInput.vue` — the raw escape hatch,
  embedded unchanged (autocomplete, validation issues, testids).
- `docs/specs/2026-07-09-1641-expression-engine-validation/` +
  `xlsform-cheatsheet/relevance.md`, `constraints.md`, `list_lookups.md` —
  source of the golden expressions and the preset regexes.
- `tests/e2e/preview.spec.ts` — preview interaction patterns reused by the
  new e2e.

## External

- https://docs.getodk.org/form-logic/ — relevant/constraint semantics.
- https://xlsform.org / pyxform — quoted-literal convention followed by the
  serializer.
