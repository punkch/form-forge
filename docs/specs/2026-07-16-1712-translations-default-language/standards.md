# Skills & Conventions — retire the "Default" language column

Repository hard invariants (CLAUDE.md) that bind this work, and why each
applies here.

---

## `src/core/` purity

- **Source:** CLAUDE.md "Hard invariants".
- **Why it applies:** all new ops (`primaryLang`, `mergeDefaultInto`,
  `normalizeDefaultContent`, changed `addLanguage`/`removeLanguage`, factory
  seeding) live in `src/core/model/` — no Vue/Pinia/Dexie/vue-i18n imports.
  The new `i18n.unassigned-text` Issue carries a verbatim English `message`
  (rendered as-is in ProblemsButton) and a stable `code` for grouping.

## Golden byte-stability (pyxform 4.5.0)

- **Source:** CLAUDE.md; `tests/golden/README.md`.
- **Why it applies:** the serializer, parser, and XLSForm reader/writer are
  untouched; normalization happens at the model/load layer, so every golden
  parity and parse→serialize round-trip gate must pass with zero regeneration.
  No files under `src/core/xform/` or `src/core/xlsform/` change.

## i18n three-catalog typecheck

- **Source:** CLAUDE.md "UI strings only via vue-i18n"; fr/es glossary in
  `docs/specs/2026-07-16-1125-ui-localization-fr-es/`.
- **Why it applies:** removes `dialogs.translationGrid.defaultColumn`,
  `dialogs.translationGrid.addLanguageFirst`, `dialogs.translations.defaultOption`,
  `dialogs.translations.unsetPlaceholder`; adds `textColumn`,
  `unassignedColumn`, `unassignedHint`, `removeLastWarning`. Every change must
  hit `src/i18n/locales/{en,fr,es}/dialogs.json` together or `pnpm typecheck`
  fails. fr/es terminology anchored to the committed ODK glossary.

## Preserve `data-testid`s

- **Source:** CLAUDE.md.
- **Why it applies:** grid cell testids stay `cell-<siteKey>-default` for the
  sentinel-keyed column (Text/Unassigned states); `panel-editing-language`,
  `default-language`, `display-language`, `lang-header-*`, `lang-completeness-*`
  are preserved. Only e2e interactions that deliberately targeted the retired
  Default column/option are rewritten.

## No undefined CSS custom properties

- **Source:** CLAUDE.md (stylelint gate).
- **Why it applies:** the Unassigned column tint uses existing `--odk-warning-*`
  tokens (fallback-guarded where a token is optional).

## Delivery process

- **Source:** CLAUDE.md "Delivery process"; auto-memory.
- **Why it applies:** shape → timestamped spec folder (this folder) →
  implementation via a dynamic Workflow with parallel agents → full suite +
  agent-browser manual pass logged to `docs/verification/` → `/code-review`
  with findings fixed immediately → conventional commits (no co-author
  trailers, per the user's global instruction) → update README Features,
  roadmap, and CLAUDE.md in the same change.

## Coverage floors

- **Source:** `pnpm test:coverage` config.
- **Why it applies:** new core branches (merge/conflict/idempotence, last-
  language restore) and store branches (load-time normalize + scheduleSave)
  all get specs; floors: core 86/78/88, stores 80/85, persistence 90/92.
