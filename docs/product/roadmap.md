# Product Roadmap

Superseded planning documents (`PRODUCT_PLAN.md`, `REQUIREMENTS.md`, `TECHNICAL_SPECIFICATION.md`, `.agent-os/product/roadmap.md`) described an 18-month, backend-connected, Material-Design-3 program. This roadmap replaces them (2026-07-09): the product is client-side-only and styled to match ODK Web Forms.

## Phase 1: MVP — the rebuild (current)

Delivered as 8 specs (see `docs/specs/`):

1. **Product docs & foundation** — scaffold (Vue 3.5 / Vite 8 / TS 5.9 / Pinia / Dexie), ODK design tokens, app shell, form library with IndexedDB persistence and autosave.
2. **Expression engine & validation** — `${field}` ↔ XPath rewriting, symbol table, form-level validators.
3. **Builder editor** — palette, question tree with drag-and-drop + keyboard commands, property panel, expression inputs with autocomplete, problems panel, undo/redo.
4. **XForm serializer & live preview** — pyxform-parity XML generation (itext, itemsets, setvalue, entities) and embedded `@getodk/web-forms` preview with submit testing.
5. **Choices, cascades & translations** — shared choice lists, cascading-select editor, multi-language translation grid.
6. **XForm import** — lossless XML parsing with round-trip guarantees.
7. **XLSForm import/export, ZIP & attachments** — native in-browser .xlsx reader/writer with row-level import reports, media attachments, ZIP export.
8. **Hardening & release readiness** — full e2e suite, pyxform golden-test matrix, accessibility, performance, docs.

**MVP success criteria:** import `all-widgets.xml` and the ODK XLSForm template cleanly; round-trip without data loss; preview any authored form in the real engine; export a ZIP that ODK Central accepts; core-engine test coverage ≥90%.

## Phase 2: Post-Launch — DELIVERED 2026-07-10

Delivered in five implementation waves (timestamped spec folders under
`docs/specs/`, verification logs under `docs/verification/`):

- **Workspace export/import** — lossless `.formforge.zip` archives (whole
  workspace or single form) with new-id imports and duplicate warnings.
- **Form templates** — bundled bilingual starter gallery + local
  save-as-template (Dexie v2).
- **External dataset tooling** — property-panel CSV/GeoJSON upload feeding
  the live preview (itemsets, `pulldata()`), column-aware value/label
  dropdowns, unknown-column validation, 500-row preview table.
- **UI internationalization** — vue-i18n foundation, typed English catalog,
  RTL-ready (logical CSS properties, `dir` switching); future locales drop
  in as catalog files.
- **Iframe embed mode** — `?embed=1` + origin-pinned postMessage API
  (load/save with attachments, host-controlled exports, memory or local
  persistence); reference host at `public/embed-demo.html`.
- **PWA packaging** — installable, fully-offline app shell (engine chunk
  precached) with a hybrid self-update policy (auto on load/idle, toast
  mid-edit).
- **CI/CD** — `ci.yml` quality+e2e, release-please release PRs on `main`,
  GitHub Pages deploy gated on e2e (see the ci-cd spec user-guide for the
  one-time setup + v1.0.0 `Release-As` bootstrap).
- **In-app help** — field popovers, per-type help drawer, searchable
  reference of all 36 question types, offline, adapted from docs.getodk.org.
- **Visual logic builder** — structured condition editor for
  relevance/constraints with a lossless raw escape hatch; calculation
  template helper.
- **Deeper entity support** — update/upsert flows golden-pinned to
  pyxform 4.5.0, Entities settings tab, per-question `save_to`, follow-up
  form wizard.
- Fixed: the preview showing the previously opened form after switching.
- Fixed: a `range` question with unset bounds crashed the live preview with
  an undismissable engine dialog — the serializer now fills `start`/`end`/
  `step` from registry defaults, validation warns on missing required
  parameters, and the preview detects web-forms' load-failure dialog and
  routes it through the builder's own recoverable error state
  (`docs/specs/2026-07-10-1945-range-preview-crash/`).
- **UX polish pass (2026-07-10 design critique)** — implemented all findings
  of the Interface Craft five-lens review
  (`docs/specs/2026-07-10-1810-ui-critique-fixes/`): logic-builder trust
  (notes excluded from operands, nearest-preceding defaults,
  `expr.empty-condition-value` warning), problems panel location chips +
  grouping + "Ready" state, export readiness summary, two-line canvas
  labels + labeled logic badges, always-labeled Preview/Export + panel/
  desktop icons, richer library cards + formatted versions, New-form
  create hint, unified help drawer (reference modal removed), and a drafted
  upstream issue for the web-forms number-input contradiction.

## Phase 3: Backlog burn-down (in progress, 2026-07-10)

Delivered:

- **Settings page** (`docs/specs/2026-07-10-2005-settings-page/`) — gear on
  the library header (replaces the ⋯ overflow menu) routing to `#/settings`:
  workspace export/import, UI-language picker persisted to `ui.locale`, About
  (app version, storage-persistence status), extension points for the future
  update-check and Central-server sections; route and gear absent in embed
  mode.
- **Renovate dependency updates**
  (`docs/specs/2026-07-10-2008-renovate-dependency-updates/`) — weekly
  self-hosted Renovate workflow + `renovate.json` encoding the pin
  discipline (PrimeVue/@primeuix and xlsx frozen, web-forms
  dashboard-approval only, TS <7). Awaiting the owner-created
  `RENOVATE_TOKEN` secret for its first run.
- **Full translation coverage**
  (`docs/specs/2026-07-10-2006-translation-coverage/`) — the grid lists
  every relevant translatable site even when empty (constraint/required
  messages gated on their bind rules, guidance hints behind a rarely-used
  toggle) plus node/choice media rows; the properties panel gains an
  explicit editing-language control and `LocalizedInput` everywhere
  (fallback as placeholder, per-language writes for constraint/required
  messages, guidance hints and choice labels); export readiness counts
  only sites with a value in ≥1 language. Core/serializer layers already
  round-tripped all of it — pure UI exposure, goldens untouched.
- **In-app guidance** (`docs/specs/2026-07-10-2007-in-app-guidance/`) —
  eight workflow guides (translations, logic builder, external datasets,
  entities + follow-up wizard, workspace backup, templates, autosave &
  snapshots, tree keyboard commands) as a searchable Guides section in the
  unified help drawer, contextual "?" triggers on their home surfaces
  (Translations dialog, logic builder, dataset/entity sections, library
  toolbar), and dismissable first-use callouts for the two silent-behavior
  traps (display-language retargeting, raw-mode logic fallback) persisted
  in the ui store. Text-only, fully offline, all copy in the typed i18n
  catalog.

Still shaped-only in [`docs/specs/backlog/`](../specs/backlog/README.md):

- **[Optional ODK Central integration](../specs/backlog/central-publishing.md)** — publish drafts to and import forms from Central via project/form pickers, multiple server records; strictly opt-in and credential-local, gated on a CORS spike against a real Central instance, keeping the no-backend default intact. **Blocked**: the spike needs a real Central instance and credentials only the maintainer can provide.
