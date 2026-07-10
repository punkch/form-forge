# Skills & Conventions for In-app guidance

## unops-toolkit:shape-spec (skill)

- **Source:** `plugins/unops-toolkit/skills/shape-spec/SKILL.md`
- **Why it applies:** used to promote the backlog shaping doc into this
  timestamped spec folder (plan/shape/references/standards/user-guide).
- **Key points:** Task 1 is always "save spec documentation"; keep shaping
  lightweight; specs are discoverable months later.

## Repo i18n convention (project standard)

- **Source:** `CLAUDE.md` "Hard invariants"; `src/i18n/index.ts`,
  `src/i18n/locales/en/index.ts`, `eslint.config.js`.
- **Why it applies:** every guide/callout/chrome string is a UI string and must
  go through the typed catalog.
- **Key points:**
  - One JSON file per namespace under `src/i18n/locales/<locale>/`, the file's
    single top-level key being its namespace. The runtime `en` object is a
    **shallow** spread of these files (`locales/en/index.ts`) — two files cannot
    share a namespace. → guides get a **new `guides.json`** (`"guides"`), not an
    addition to `help.json`.
  - `MessageSchema = typeof en`; `MessageKey = NestedKey<MessageSchema>`. Adding
    `guides.json` to the merge auto-extends `MessageKey`; `guideHelp`'s literal
    keys are vue-tsc-checked. `useAppI18n().t` / `translate` accept only catalog
    keys.
  - `@intlify/vue-i18n/no-missing-keys` is an **error**; its `localeDir` glob
    `src/i18n/locales/*/*.json` auto-discovers `guides.json`. `no-raw-text` is a
    warning — no literal user text in templates.
  - **Keep rendered English byte-stable** unless intentionally changing copy
    (tests assert strings). This feature only adds new keys; it reworders no
    existing string, including in the Translations dialog.

## Repo help/registry convention (project standard)

- **Source:** `docs/specs/2026-07-10-0850-in-app-help/` (plan/shape),
  `src/help/content.ts`, `src/help/search.ts`.
- **Why it applies:** guides extend the same typed-registry → i18n pattern and
  the same drawer.
- **Key points:** typed index of literal `MessageKey`s (`satisfies Record<…>`), a
  consistency unit test as the second net after vue-tsc, one shared detail
  renderer so surfaces can't drift, and `docsUrl()`-style resolution for external
  links. Reuse `search.ts` shape for guide search rather than duplicating match
  logic.

## Repo hard invariants that constrain this work (`CLAUDE.md`)

- **`src/core/` stays pure** — this feature touches only `src/help`, `src/stores`,
  `src/components`, `src/views`, `src/i18n`; no core changes.
- **Preserve `data-testid`s** — e2e helpers depend on them. Existing help testids
  (`help-drawer`, `help-search`, `help-reference`, `help-ref-item-*`) are
  unchanged; new ones are additive (`help-guide-item-*`, `help-guide-*`,
  `guide-trigger-*`, `guide-callout-*`).
- **Persistence through the seam** — callout dismissal is a device pref in the
  `ui` store's localStorage (`odk-builder:ui:v1`), like `storageHintDismissed`;
  it is not form content and does not go through the Dexie backend.
- **Conventional commits**, work on `development`; one commit per feature; update
  README Features, `docs/product/roadmap.md`, and `CLAUDE.md` in the same change.

## Delivery process

Shape (this folder) → implement via a dynamic Workflow with the parallel packages
in `plan.md` → verify (full suite + agent-browser pass logged to
`docs/verification/`) → `/code-review` (five lenses, fix findings immediately) →
conventional commit → update README/roadmap/CLAUDE.md and move the delivered item
out of `docs/specs/backlog/`.
