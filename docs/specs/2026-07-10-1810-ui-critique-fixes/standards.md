# Skills & Conventions for UI Critique Fixes

The following conventions apply to this work (source: `CLAUDE.md` hard
invariants + established delivery process).

---

## Core purity (`src/core/`)

- **Source:** `CLAUDE.md` → Hard invariants
- **Why it applies:** the empty-condition-value warning and the
  answerable-field predicate live in core (`src/core/validate/`,
  `src/core/expr/structured.ts`, `src/core/registry/question-types.ts`).
- **Key points:** no Vue/Pinia/Dexie/vue-i18n imports in core; new Issues
  use factories in `src/core/validate/issues.ts` with stable `code`
  strings and English messages; the UI localizes by code.

## UI strings via vue-i18n only

- **Source:** `CLAUDE.md`; `src/i18n/locales/en/*.json`, typed
  `MessageSchema`
- **Why it applies:** every new label (badge tooltips, Ready state,
  readiness summary, Create hint, card chips) is user-visible copy.
- **Key points:** add keys to the right namespace file; eslint
  `no-missing-keys` is an error; components use `useAppI18n()`, stores use
  `translate`. Rendered-English changes are intentional here — update the
  string-asserting tests in the same commit.

## Preserve `data-testid`s

- **Why it applies:** e2e helpers (`tests/e2e/helpers.ts`) and specs
  navigate by testid; the library card redesign and help unification touch
  testid-bearing markup.
- **Key points:** keep `form-card-{formId}`, `new-form*`, `palette-toggle`,
  `preview-button`, `export-button`, `problems-button`, `help-button`,
  `node-card-{name}`, dialog roots. New affordances get new testids.

## Serializer pinning / golden tests

- **Why it applies:** structured-condition changes must not alter
  serialization. `trySerializeStructured` and expression output stay
  byte-identical; only *defaults for new conditions* and *validation*
  change. Golden gates (`tests/golden/`) must stay green untouched.

## Coverage floors

- **Source:** vitest config — core 86/78/88, stores 80/85, persistence
  90/92.
- **Key points:** new core code (validator, predicate) ships with unit
  tests; component changes with component tests.

## Delivery process

- **Source:** `CLAUDE.md` → Delivery process; memory notes.
- **Key points:** timestamped spec folder (this one) → implement via
  dynamic Workflow with parallel agents → verify (full suite + agent-browser
  pass logged to `docs/verification/`) → `/code-review` (no plan mode), fix
  findings immediately → conventional commits → update README Features,
  `docs/product/roadmap.md`, and `CLAUDE.md` in the same change.

## Design conventions

- **Source:** `src/styles/odk-tokens.css`, `src/styles/builder.css`,
  PrimeVue 4.3.3 Aura preset pinned byte-identical to `@getodk/web-forms`
  (`pnpm verify:webforms`).
- **Key points:** no preset edits; new styling uses existing `--odk-*` /
  `--builder-*` tokens; primeicons only (no new icon family).
