# Skills & Conventions for Media Labels & Annotation

## CLAUDE.md hard invariants (repository)

- **Pure-TS core** — `src/core/` takes no Vue/Pinia/Dexie/vue-i18n imports. The new `defaults.ts` module and all serializer/validator/rename changes stay pure.
- **i18n en/fr/es lockstep** — every new key lands in `src/i18n/locales/{en,fr,es}/` in the same commit (`MessageSchema = typeof en`, fr/es `satisfies` it; vue-tsc fails on drift). Terminology per the glossary in `docs/specs/2026-07-16-1125-ui-localization-fr-es/`. Existing English strings stay byte-stable.
- **Issue messages are stable API** — reuse code `ref.missing-attachment`; the new default-image message is a NEW string; never reword the existing ones (e2e asserts substrings).
- **Golden policy** — serializer behavior pinned to pyxform 4.5.0; fixtures regenerated selectively via `uv run --with openpyxl --with pyxform scripts/make-goldens.py annotate media_labels` (a deliberate, reviewed act; full regen churns every .xlsx).
- **Mirror-traversal contract** — `collectAttachmentReferences` / `renameAttachmentRefs` (`src/core/model/rename-attachment.ts`) and `validateRefs` (`src/core/validate/refs.ts`) must traverse the same reference sites; the image-default site is added to all three plus their doc comments.
- **Stylelint CSS-var guard** — no bare `var(--x)` without a defined token; new component CSS uses existing `--odk-*`/`--builder-*` tokens.
- **Preserve `data-testid`s** — existing ids untouched; new ids listed in plan.md.
- **Conventional commits**, work directly on `main`, no self-attribution trailers.

## Delivery process

- Spec folder first (this folder), then implementation via **dynamic Workflow** with parallel agents — implementation agents on cheaper models (sonnet default, haiku for mechanical edits), orchestration/review at session level.
- Full suite (`pnpm test`, `test:e2e`, `lint`, `typecheck`) + agent-browser manual pass logged to `docs/verification/` + `/interface-craft` critique of new UI.
- `/code-review` (five lenses, no plan mode); findings fixed immediately.
- Update README Features, `docs/product/roadmap.md`, CLAUDE.md index in the same delivery.
