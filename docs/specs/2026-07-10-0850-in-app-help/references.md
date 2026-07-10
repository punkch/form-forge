# References — In-App Help System

## Files added

- `src/help/content.ts` — typed catalog index (`typeHelp`, `fieldHelp`,
  `HelpFieldKey`, `getTypeHelp`, `docsUrl`, `ODK_QUESTION_TYPES_DOCS_URL`).
- `src/help/search.ts` — `matchesTypeSearch` shared matcher.
- `src/i18n/locales/en/help.json` — `help` namespace: `ui`, `types` (36),
  `fields` (16).
- `src/components/help/QuestionTypeHelpContent.vue` — shared detail body.
- `src/components/help/QuestionTypeHelpDrawer.vue` — right-side drawer.
- `src/components/help/HelpReference.vue` — searchable reference dialog.
- `src/components/help/HelpPopover.vue` — field "?" popover (call sites are
  a follow-up).
- `tests/unit/help-content.spec.ts`
- `tests/component/help.spec.ts`
- `tests/e2e/help.spec.ts`

## Files changed

- `src/core/registry/question-types.ts` — `docsAnchor?: string` +
  per-type values (verified against docs.getodk.org section ids).
- `src/stores/editor.ts` — `'help-reference' | 'help-type'` dialog entries,
  `helpTypeId`, `openTypeHelp()`, reset handling.
- `src/components/EditorDialogs.vue` — mounts the two help surfaces.
- `src/components/shell/AppHeader.vue` — header Help button
  (`data-testid="help-button"`).
- `src/components/palette/QuestionPalette.vue` — item rows restructured
  (row div wraps the draggable button + `palette-item-info-<type>` button);
  search delegated to `matchesTypeSearch`.
- `src/components/properties/PropertyPanel.vue` — header help button
  (`data-testid="property-help"`).
- `src/i18n/locales/en/index.ts` — registers the `help` namespace.

## Test IDs

`help-button`, `help-reference`, `help-search`, `help-ref-item-<type>`,
`help-ref-detail`, `help-ref-back`, `help-ref-empty`, `help-drawer`,
`help-content`, `help-appearances`, `help-parameters`, `help-read-more`,
`palette-item-info-<type>`, `property-help`, `field-help-<field>`,
`field-help-body-<field>`.

## External references

- https://docs.getodk.org/form-question-types/ — anchor source of truth
  (fetched 2026-07-10 to verify every `docsAnchor`).
- https://docs.getodk.org/form-repeats/, /form-datasets/, /form-audit-log/
  — absolute targets for repeat, csv-external / select-from-file context,
  audit.
- ODK docs license: CC-BY; attribution rendered in the reference footer.
