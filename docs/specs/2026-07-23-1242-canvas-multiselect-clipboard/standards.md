# Skills & Conventions — canvas multi-select/clipboard/toolbar/insert-from-template

Repo invariants (CLAUDE.md) that bind this work, and how they apply:

## Core purity

`src/core/clipboard/` (payload + merge) and the new `src/core/model/multi-ops.ts` are pure TS —
no Vue/Pinia/Dexie/vue-i18n imports. Browser APIs (localStorage, navigator.clipboard, window
events) live in the new app-level `src/clipboard/` — the same pure-vs-apply split as
`src/theme/` (constants pure, index applies).

## i18n three-locale mirroring, byte-stable English

Every new en key (canvas.json, shell.json, stores.json, guides.json) gets fr + es in the same
change (`satisfies MessageSchema` makes `pnpm typecheck` fail otherwise). Existing rendered
English stays byte-stable — e2e asserts substrings (guides.spec.ts pins logic/translations/
backup guide text; the keyboard/templates guides being extended are NOT pinned). fr/es
terminology anchored to the glossary in `docs/specs/2026-07-16-1125-ui-localization-fr-es/`.
UI strings via `useAppI18n()` in components, `translate()` in stores.

## Guides registry gates

`tests/unit/guides-content.spec.ts` enforces GUIDE_KEYS ≡ guideHelp keys, EN step-count parity
registry↔catalog, searchKeywords required, callout keys resolve. New `canvas` guide + extended
keyboard/templates step arrays must land in `src/help/content.ts`, `src/help/guides.ts`, and
all three `guides.json` files together.

## No undefined CSS custom properties / motion tokens only

CanvasToolbar CSS uses only existing tokens (`--builder-*`, `--odk-spacing-*`) — stylelint
(`value-no-unknown-custom-properties`) fails on a bare undefined `var()`. No literal
durations/easings — motion only via `--builder-motion-*` tokens; the selection flash reuses the
existing `--builder-flash-*` pair / `revealNodeId` mechanics. Exits stay ≤200ms.

## Testid preservation

`form-menu` (moves to the gear — same testid, same menuitem labels ⇒ 15 e2e flows survive),
`editor-form-title`, `node-card-<name>`, `delete-node`, `canvas-list`, `container-list-<id>`
all preserved. New testids listed in plan.md.

## Undo discipline

One user gesture = one undo entry: store actions early-return before `mutate` (it pushes undo
unconditionally); the multi-drag gather runs inside the existing begin/endTransaction bracket
(never via `mutate` mid-transaction). `endTransaction` drops no-op entries by JSON equality.

## Serializer/goldens

No serializer/parser change anywhere in this work — `tests/golden/` must be untouched.

## Persistence

No new Dexie table/field, no workspace-archive change, no new persisted ui pref (the callout
rides the existing `dismissedCallouts`; the clipboard buffer is localStorage-direct with its own
versioned key `formforge.clipboard.v1`, deliberately NOT part of the workspace backup — it is
transient transfer state, not authored content).

## Conventional commits

One conventional commit for the feature, no Co-Authored-By trailer, only after user
confirmation. CLAUDE.md code map + README Features + roadmap updated in the same change.
