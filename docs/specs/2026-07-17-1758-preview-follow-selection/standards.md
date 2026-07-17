# Preview follows canvas selection — Standards

- **Pure logic / thin DOM split**: `src/preview/followSelection.ts` imports
  only from `@/core` (model types/ops + registry) — no Vue, no DOM types
  beyond plain data. All DOM reading/scrolling lives in `PreviewHost.vue`;
  all wiring in `PreviewPanel.vue`.
- **Motion invariant**: no literal timings — flash animation uses
  `--builder-motion-duration-flash` / `--builder-motion-ease-standard`.
  Programmatic smooth scroll is JS-gated on
  `matchMedia('(prefers-reduced-motion: reduce)')` (the CSS blanket cannot
  reach `scrollIntoView` behavior) — same pattern as `TreeNodeCard.vue`.
- **Generation guards**: every async hop in `PreviewHost` (the `onLoaded`
  forward included) checks `myGeneration === generation` so a torn-down
  mount can never emit or scroll.
- **Benign failure only**: `followQuestion` returns false rather than
  throwing; the panel ignores failures. No user-facing error states, no
  console noise.
- **No i18n changes**: the feature renders no text. Do not add catalog keys.
- **No new dependencies, no core/persistence/store schema changes.**
- **Preserve `data-testid`s**; the e2e spec locates web-forms questions by
  class + text (we cannot add testids to the child app's DOM).
- **e2e filter gotcha**: `pnpm test:e2e preview-follow-selection` — never
  `--` before the filter (silently runs the full suite).
- Code style: neostandard (no semicolons, single quotes), comments only for
  constraints the code can't show, mirror neighboring files.
- Conventional commit, **no co-author trailer** (user's global rule).
