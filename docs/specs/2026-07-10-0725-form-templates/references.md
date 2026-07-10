# References — Form Templates & Starter Gallery

## Files added

- `scripts/make-templates.ts` — deterministic template generator
  (`buildTemplates` / `templateJson` / `writeTemplates`).
- `src/templates/household-survey.json`,
  `src/templates/individual-registration.json`,
  `src/templates/site-monitoring-visit.json`,
  `src/templates/feedback-satisfaction.json` — generated artifacts.
- `src/templates/index.ts` — `bundledTemplates` registry with lazy,
  `migrateDoc`-guarded `load()`.
- `src/persistence/templates-repo.ts` — `listTemplates` / `addTemplate` /
  `deleteTemplate` / `templatePreview`.
- `src/persistence/templates-repo.spec.ts` — incl. the v1→v2 upgrade test.
- `src/components/library/NewFormDialog.vue` — two-phase gallery dialog.
- `tests/unit/templates-generator.spec.ts` — validity + JSON byte-parity
  (+ regeneration entry point via `REGENERATE_TEMPLATES=1`).
- `tests/unit/templates-registry.spec.ts` — load/migrate/validate/
  instantiate every bundled template; honest precomputed metadata.
- `tests/component/new-form-dialog.spec.ts`
- `tests/e2e/templates.spec.ts`

## Files changed

- `src/core/model/factory.ts` — `instantiateTemplate()` (+ cases in
  `src/core/model/factory.spec.ts`).
- `src/persistence/db.ts` — schema v2 `templates` table, `TemplateRecord`,
  `DexieOptions` injection for upgrade specs.
- `src/stores/workspace.ts` — `createFormFromTemplate()`.
- `src/views/FormLibraryView.vue` — uses `NewFormDialog`; row menu "Save as
  template" + its dialog.
- `src/i18n/locales/en/library.json` — `library.newFormDialog.*` additions,
  `library.templates.*`, `library.saveTemplateDialog.*`,
  `library.menu.saveTemplate`, `library.toast.templateSaved`.
- `tsconfig.app.json` — includes `scripts/make-templates.ts` so the
  generator stays type-checked.

## Files consulted (unchanged)

- `src/core/model/ops.ts` (`visit`, `flatten`, `countQuestions`,
  `cloneSubtree` — deliberately not reused for whole-template cloning).
- `src/core/model/migrate.ts`, `src/core/model/display.ts`,
  `src/core/model/translations.ts` (language-key convention).
- `src/core/validate/index.ts`, `src/core/xform/serializer.ts`
  (generator assertions).
- `tests/e2e/helpers.ts` (`new-form-title` / `new-form-create` contract).
