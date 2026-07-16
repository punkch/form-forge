# Standards — parameter-specific help popovers

Repo invariants from `CLAUDE.md` that constrain this feature, and how each
applies here.

- **`src/core/` is pure TS.** The registry metadata audit
  (`src/core/registry/question-types.ts`) adds only plain-data fields
  (`description`, `options`, `defaultValue` strings/arrays/primitives) to
  existing `QuestionTypeParameter` objects — no i18n, Vue, Pinia or Dexie
  import enters `src/core/`. Registry English continues to render verbatim
  in the UI (the same policy that already governs `Issue` messages,
  appearance descriptions and the drawer's PARAMETERS table); this feature
  adds a second verbatim renderer (the popover) rather than a new exception.
- **UI strings only via vue-i18n; rendered English stays byte-stable except
  deliberate changes.** All new popover chrome (the "Options"/"Default"/
  "Required" labels, the "XLSForm column `parameters` · key `<name>`"
  mapping line) goes through new typed `help.ui.popover.*` keys in
  `src/i18n/locales/en/help.json`, indexed as `MessageKey`s so
  `@intlify/vue-i18n/no-missing-keys` (error-level) catches a missing or
  misspelled key at lint time. The one intentional English removal is
  `help.fields.parameters.{whatItIs,xlsformColumn}` — deleted together with
  its only consumer, not left as an orphan key. Nothing else in the English
  catalog changes.
- **Preserve `data-testid`s.** The feature is additive: new
  `field-help-param-<name>` / `field-help-body-param-<name>` ids replace the
  old duplicate `field-help-parameters` / `field-help-body-parameters` ids
  (verified: no e2e test references the old ids; the component spec that
  does is updated in the same change). No other popover's testid changes.
- **No undefined CSS custom properties (stylelint gate).** Any new CSS added
  to `HelpPopover.vue` for the options/default/required lines reuses the
  `--odk-*` tokens already referenced in the same file (`--odk-spacing-s`,
  `--odk-spacing-m`, `--odk-hint-font-size`, `--odk-muted-text-color`,
  `--odk-muted-background-color`, `--odk-text-color`) — no new bare
  `var(--x)` is introduced, so the `value-no-unknown-custom-properties` rule
  needs no allowlist change.
- **Serializer behavior is pinned to pyxform 4.5.0 (`tests/golden/`).** The
  registry metadata audit is scoped to `description`/`options`/`defaultValue`
  only; parameter **names** and any **value** a form actually serializes are
  untouched, so the golden parity + round-trip suites are expected to pass
  unchanged with no golden regeneration.
- **Conventional commits.** Two commits land this feature: one for the
  component/wiring change (`HelpPopover.vue`, `TypeConfigSection.vue`, the
  `help.json`/`content.ts` catalog edit, tests), and a separate one for the
  registry metadata audit (data-only, `src/core/registry/question-types.ts`)
  — kept apart so each diff reads as a single concern and the pure-data
  commit is trivially reviewable against the golden suite staying green.

Not applicable to this feature: the workspace-backup format-version rule (no
persisted Dexie table or field changes), the both-backend persistence-spec
rule (no persistence touched at all — this is a pure presentation feature).

## Process skills used

- Dynamic Workflows with Sonnet implementors carry out the task breakdown in
  `plan.md`.
- `/agent-browser` drives the properties panel to open the new
  parameter-specific popovers (a boolean param, an options param, a
  from-file value/label param) and screenshots them; `/interface-craft`
  critiques the popover's layout/wrapping/spacing since automated tests
  cannot see CSS layout.
- `/code-review` (five lenses, no plan mode) runs on the wave's diff before
  commit; findings are fixed immediately, not deferred.
- The manual pass is logged to
  `docs/verification/2026-07-16-parameter-help-tooltips/` (screenshots +
  notes), per the project's established verification convention.
