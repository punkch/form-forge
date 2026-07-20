# Skills & Conventions for Template Management

## CLAUDE.md hard invariants (repository)

- **Persistence goes through the backend seam** — repos keep identical signatures across
  the Dexie default and the embed memory backend; specs run on both via
  `tests/helpers/backends.ts`. This binds Task 2 directly: `getTemplate`/`putTemplate` land
  in `src/persistence/backend.ts` **and** `memory-backend.ts` with matching signatures, and
  `updateTemplate`/`replaceTemplate` in `templates-repo.ts` go through
  `getPersistenceBackend()` — never `db` directly — so the new repo functions get
  both-backend coverage for free instead of silently only working against Dexie.

  > "Persistence goes through the backend seam (`src/persistence/backend.ts`). Repos keep
  > identical signatures across the Dexie default and the embed memory backend; specs run
  > on both via `tests/helpers/backends.ts`."

- **The whole-workspace backup must round-trip the entire data model** — this is why
  `hiddenBundledTemplates` is designed to ride the existing `preferences.json` section for
  free rather than opening new backup-format work, and why the plan is explicit that no
  `WORKSPACE_FORMAT_VERSION` bump is needed: it's a purely additive field on a section
  that's already read best-effort.

  > "Bump only when an older reader would *misread* the archive; a purely additive optional
  > section (read best-effort, absent = handled) rides the current version instead, because
  > the reader hard-rejects any archive **newer** than it supports — so a needless bump makes
  > a slightly-stale app refuse an entire backup over a section it could have safely ignored."

- **UI strings only via vue-i18n, en/fr/es in lockstep** — every new key (delete-confirm
  copy, rename dialog labels, hide/unhide/restore aria labels and disclosure text, the
  save-template collision prompt) must land in `en/library.json` **and** be mirrored into
  `fr/` and `es/` in the same change; `MessageSchema = typeof en` means `pnpm typecheck`
  fails on any drift. Terminology follows the established glossary
  (`docs/specs/2026-07-16-1125-ui-localization-fr-es/`): template → *modèle* / *plantilla*.
  Reuse `common.delete`/`common.cancel` rather than adding near-duplicate keys.

  > "UI strings only via vue-i18n — typed per-namespace catalog in `src/i18n/locales/en/`,
  > `useAppI18n()` in components, `translate` in stores; eslint `no-missing-keys` is an
  > error. Keep rendered English byte-stable unless intentionally changing copy (tests assert
  > strings). French + Spanish ship as full catalogs mirroring en (`MessageSchema = typeof
  > en`, fr/es `satisfies` it): every en key you add/remove/rename MUST get the same change
  > in `src/i18n/locales/{fr,es}/` or `pnpm typecheck` fails."

- **Motion only via `--builder-motion-*` tokens** — the hide/show disclosure ("Show hidden
  starters (N)") is a collapse/expand interaction; any transition on it must use the shared
  duration/easing tokens already defined in `builder.css`, never a literal millisecond value
  in component CSS.

  > "Motion only via `--builder-motion-*` tokens — durations/easings live in `builder.css`
  > `:root` (4 beats: xs 80/s 120/m 160/l 200ms + flash 900ms; 4 curves incl.
  > transform-only `pop`); NO literal timings in component CSS."

- **No undefined CSS custom properties** (stylelint gate) — the restructured bundled-card
  markup and any new hide/unhide icon-button styling must reuse existing
  `.local-card`/`.local-card-main`/`.local-card-delete` rules and known `--odk-*`/
  `--builder-*` tokens; `pnpm lint` runs stylelint's `value-no-unknown-custom-properties`
  over `src/**/*.{css,vue}` and will fail on a bare `var(--x)` whose token isn't defined.

  > "A bare `var(--x)` whose token is never defined silently invalidates the whole
  > declaration (a gap/padding collapses to 0); nothing else catches it... `pnpm lint` runs
  > **stylelint**... to fail on it."

- **Preserve `data-testid`s** — e2e helpers depend on them. Every existing testid in
  `NewFormDialog.vue` and `FormLibraryView.vue` stays byte-identical; the plan's new testids
  (`new-form-local-rename`, `new-form-starter-hide`, `new-form-starter-unhide`,
  `new-form-show-hidden`, `new-form-restore-starters`, `template-rename-*`) are additions,
  not replacements.

  > "Preserve `data-testid`s — e2e helpers depend on them."

- **Conventional commits** — release-please derives versions from them; work directly on
  `main`. No self-attribution trailers on commits (global user instruction, overrides any
  default trailer behavior).

  > "Conventional commits — release-please derives versions from them; work directly on
  > `main` (release-please opens release PRs against it)."

## Delivery process

- Spec folder first (this folder) → implementation via dynamic Workflow with parallel
  agents, implementation agents on cheaper models (sonnet/haiku), orchestration and review
  at session level.
- Full suite (`pnpm typecheck && pnpm test && pnpm lint`) green before verification.
- Agent-browser manual pass logged to `docs/verification/` — required here specifically
  because automated gates are blind to CSS layout and to overlay/z-index stacking (the
  `ConfirmDialog` and rename `Dialog` opening on top of the already-modal New form dialog).
- `/code-review` (five lenses, no plan mode); findings fixed immediately.
- Update README Features, `docs/product/roadmap.md`, and CLAUDE.md's code-map/store rows in
  the same delivery (the repo's "keep this file up to date" mandate).
