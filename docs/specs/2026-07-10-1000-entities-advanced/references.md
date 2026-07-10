# References — Entities Advanced

## Files changed

- `scripts/make-goldens.py` — `entities_update` and `entities_follow_up`
  fixtures (same dict style as the existing eight).
- `tests/golden/src/entities_update.xlsx`, `entities_follow_up.xlsx`,
  `tests/golden/expected/entities_update.xml`, `entities_follow_up.xml` —
  regenerated with `uv run --with openpyxl --with 'pyxform==4.5.0'
  scripts/make-goldens.py`; pre-existing expected XML byte-identical.
- `tests/golden/golden.spec.ts` — the two new FIXTURES entries.
- `tests/golden/xlsform-bridge.spec.ts` — fixture count 8 → 10.
- `src/core/xform/serializer.ts` — entity create/update emission rewritten
  to pyxform 4.5.0 (static `create`/`update` markers, `@create`/`@update`
  calculate binds, `baseVersion`/`trunkVersion`/`branchId` attributes +
  version-pointer binds, `@id` calculate for update).
- `src/core/xform/parser.ts` — entity block only: captures
  `@create`/`@update`/`@id` bind calculates, drops derived version-pointer
  binds, keeps legacy inline-attribute parsing. (Out-of-list file; forced
  by the `roundtrip.spec.ts` golden gate — see shape.md.)
- `src/core/validate/entities.ts` — reserved/invalid/duplicate `save_to`
  (errors, pyxform-parity), `entities.follow-up-no-source` and
  `entities.dataset-file-mismatch` (warnings).
- `src/core/validate/entities.spec.ts` (new) — unit tests for all rules.
- `src/components/settings/FormSettingsDialog.vue` — Tabs (General |
  Entities), declaration editor, save_to overview table, follow-up wizard,
  remove action.
- `src/components/properties/EntitySection.vue` (new) — `save_to` input +
  staged `HelpPopover field="saveTo"` + inline issues; exports
  `canSaveTo()`.
- `src/components/properties/PropertyPanel.vue` — renders the Entity
  section after Logic when a declaration exists and `canSaveTo` holds.
- `src/i18n/locales/en/settings.json` — `settings.tabs.*`,
  `settings.entities.*`; `src/i18n/locales/en/properties.json` —
  `properties.panel.sectionEntity`, `properties.entity.*` (additive; the
  staged `help.fields.saveTo.*` keys already existed).
- `tests/component/entities.spec.ts` (new), `tests/e2e/entities.spec.ts`
  (new).

## Key testids

`settings-tab-general` / `settings-tab-entities`, `entity-declare`,
`entity-dataset-name`, `expr-entityLabel` / `expr-createIf` /
`expr-updateIf` / `expr-entityId`, `entity-issue`,
`entity-save-to-table` / `entity-save-to-row`, `entity-follow-up`,
`entity-follow-up-done`, `entity-remove`, `prop-section-entity`,
`prop-save-to`, `save-to-issue`, `field-help-saveTo`.

## External

- pyxform 4.5.0 entities emission (probed; see shape.md findings).
- ODK entities spec: entities-version 2024.1.0 offline entities
  (trunkVersion/branchId), https://getodk.github.io/xforms-spec/entities.
- @getodk/web-forms 1.0.0 `fetchFormAttachment` +
  `missingResourceBehavior: 'BLANK'` (spike GO).
