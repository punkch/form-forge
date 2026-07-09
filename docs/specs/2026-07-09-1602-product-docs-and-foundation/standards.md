# Skills & Conventions for Spec 01

## agent-browser (skill)

- **Why it applies:** every spec ends with a real-browser verification pass; checklists live in `docs/verification/`.
- **Key points:** drive the dev server, screenshot the library/editor, verify ODK look (Roboto, #3e9fcc primary, slate surfaces, 6px radii), exercise create/rename/delete + reload persistence.

## unops-toolkit:plan-product / shape-spec (skills)

- **Why they apply:** user explicitly requested them for product docs and per-spec shaping.
- **Key points:** product docs at `docs/product/{mission,roadmap,tech-stack}.md`; each spec folder carries plan/shape/standards/references/user-guide.

## Code standards (from REQUIREMENTS.md, still current)

- pnpm as package manager; ESLint with neostandard (flat config); TypeScript strict mode, 100% TS coverage in new code; Vue 3 Composition API with `<script setup lang="ts">`.
- Tests: Vitest (unit/component, >90% target for core), Playwright (e2e).
- `src/core/` is pure TypeScript — no Vue, Pinia, or Dexie imports allowed there.

## Styling conventions

- All builder chrome colors/typography derive from `--odk-*` / `--p-*` tokens (`src/styles/odk-tokens.css` mirrors the web-forms bundle); builder-specific vars are namespaced `--builder-*`.
- No `cssLayer` in PrimeVue config (would lose to web-forms' unlayered runtime CSS).
