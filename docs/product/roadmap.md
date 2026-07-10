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

- **Workspace export/import** — lossless `.odkbuilder.zip` archives (whole
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

## Phase 3: Remaining backlog

Still shaped-only in [`docs/specs/backlog/`](../specs/backlog/README.md):

- **[Optional ODK Central publishing](../specs/backlog/central-publishing.md)** — strictly opt-in and credential-local, gated on a CORS spike against a real Central instance, keeping the no-backend default intact.
- **[Renovate dependency updates](../specs/backlog/renovate-dependency-updates.md)** — self-hosted Renovate GitHub Action; needs the repo pushed + a token.
- **[Full translation coverage](../specs/backlog/translation-coverage.md)** — translation grid rows for all XLSForm-translatable columns (hints, messages, media) even when empty, plus a visible and consistent per-language editing mode in the properties panel.
- **[In-app guidance](../specs/backlog/in-app-guidance.md)** — workflow guides (translations, logic builder, datasets, entities, backup…) in the help drawer with contextual "?" entry points and dismissable callouts for silent-behavior traps.
