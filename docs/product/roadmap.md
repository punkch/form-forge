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

## Phase 2: Post-Launch

Each feature is shaped in [`docs/specs/backlog/`](../specs/backlog/README.md)
(recommended order and efforts there):

- **[Workspace export/import](../specs/backlog/workspace-export-import.md)** — backup/move/share all forms + attachments as one archive.
- **[Form templates](../specs/backlog/form-templates.md)** and a starter-template gallery.
- **[External dataset tooling](../specs/backlog/external-dataset-tooling.md)** — CSV/GeoJSON preview, column-aware parameters.
- **[PWA packaging](../specs/backlog/pwa-packaging.md)** (installable, offline service worker) for field laptops/tablets.
- **[Visual logic builder](../specs/backlog/visual-logic-builder.md)** for relevance/constraints on top of the expression engine.
- **[Deeper entity support](../specs/backlog/entities-advanced.md)** as the ODK Entities spec evolves.
- **[Optional ODK Central publishing](../specs/backlog/central-publishing.md)** — strictly opt-in and credential-local, gated on a CORS spike, keeping the no-backend default intact.
