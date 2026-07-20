# Skills & Conventions for Template & Backup UX Polish

The repo's own CLAUDE.md hard invariants bind this work. No external plugin skill is
central here — it is store/persistence/UI/i18n polish — but the repo conventions below
apply directly, each with the touch point it constrains.

---

## Persistence goes through the backend seam (CLAUDE.md invariant)

- **Why it applies:** the dedupe (`importArchiveTemplates`) and the round-trip tests must
  work on **both** the Dexie default and the embed memory backend. `importArchiveTemplates`
  already goes through `getPersistenceBackend()`; keep it that way (it reads
  `listTemplates()` and calls `addTemplate` on the seam). The new
  `workspace-full-backup.spec.ts` dedupe cases run under `backendCases`
  (`tests/helpers/backends.ts`).
- **Key point:** `firstFreeTemplateTitle` is pure (no backend) and unit-tested in isolation;
  the dedupe signature reads only `template.title` + `template.doc`, both already in hand.

> "Persistence goes through the backend seam (`src/persistence/backend.ts`). Repos keep
> identical signatures across the Dexie default and the embed memory backend; specs run on
> both via `tests/helpers/backends.ts`."

## The whole-workspace backup round-trips the entire data model — but this is additive (CLAUDE.md invariant)

- **Why it applies:** dedupe changes **restore behaviour**, not the archive bytes. No
  `WORKSPACE_FORMAT_VERSION` bump — `RestoreWorkspaceResult` gains a `templatesSkipped`
  return field, which is not persisted and not read from the archive. An older reader never
  misreads anything.
- **Key point:** templates already ride `templates.json` at formatVersion 2 without a bump
  (delivered `6fe48c2`); this change stays inside that section's *reader*, not its schema.

> "Bump only when an older reader would *misread* the archive; a purely additive optional
> section (read best-effort, absent = handled) rides the current version instead."

## UI strings only via vue-i18n, en/fr/es in lockstep (CLAUDE.md invariant)

- **Why it applies:** every new key (`editContentHint`, `collisionHint`,
  `templateSavedDetail`, `templatesImportedPart`, `templatesSkippedPart`, the
  `exportContents*` set) must land in `en` **and** be mirrored into `fr`/`es` in the same
  change; `MessageSchema = typeof en` fails `pnpm typecheck` on drift. Item 6 tooltips reuse
  existing aria keys — no new keys.
- **Key point:** terminology per the 1125 glossary — template → *modèle* / *plantilla*,
  Central server → *serveur Central* / *servidor Central*. Reuse `common.*` where possible.
  Two English strings change deliberately (the archive import detail + the template-saved
  toast detail) — update the tests that assert them.

> "French + Spanish ship as full catalogs mirroring en (`MessageSchema = typeof en`, fr/es
> `satisfies` it): every en key you add/remove/rename MUST get the same change in
> `src/i18n/locales/{fr,es}/` or `pnpm typecheck` fails."

## Motion / attention-flash only via `--builder-*` tokens (CLAUDE.md invariant)

- **Why it applies:** the item-3 Enter cue is an attention-flash on the collision panel. It
  must reuse the shared flash recipe, not a literal timing.
- **Key point:** the canonical recipe is `TreeNodeCard.vue:231–237` — a `@keyframes`
  animation named `just-added-flash` driven by `--builder-motion-duration-flash` and the
  `--builder-flash-tint` / `--builder-flash-ring` pair (`src/styles/builder.css:81–82`).
  Mirror that keyframes block in FormLibraryView's scoped CSS (or reuse the same pattern),
  toggled by a `collisionFlash` class.

> "Motion only via `--builder-motion-*` tokens — durations/easings live in `builder.css`
> `:root` (… flash 900ms …); NO literal timings in component CSS."

## No undefined CSS custom properties — stylelint gate (CLAUDE.md invariant)

- **Why it applies:** the new flash class and the Textarea/hint styling must reference only
  defined `--odk-*` / `--builder-*` tokens; `pnpm lint` fails on a bare `var(--x)` whose
  token is undefined.

## Preserve `data-testid`s (CLAUDE.md invariant)

- **Why it applies:** e2e + component helpers depend on them. All existing ids stay
  byte-identical; new ids are additions: `save-template-collision-hint`,
  `template-edit-content-hint`, `settings-export-summary`. The shared `ImportCollisionPanel`
  and its `save-template-collision*` prefix are untouched.

## Conventional commits, work on `main`, no self-attribution trailer

- Release-please derives versions from commit type. One `feat(templates): …` (or
  `fix(templates): …`) commit for the pass; **no** `Co-Authored-By` trailer (global user
  instruction).

## Delivery process

Spec folder first (this folder) → i18n + persistence land first → component tasks in
parallel (different files) → tests (both backends) → docs → full suite green →
`/agent-browser` + `/interface-craft` pass logged to `docs/verification/` → `/code-review`
five lenses → conventional commit. Implementation agents on cheaper models
(sonnet/haiku); orchestration + review at session level.
