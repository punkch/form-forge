# Standards — Form Templates & Starter Gallery

Follows the existing project standards
(`docs/specs/2026-07-09-1602-product-docs-and-foundation/standards.md`):
strict TypeScript, neostandard ESLint (no semicolons), Vitest colocated
`*.spec.ts`, fake-indexeddb for persistence specs, all UI strings through
the typed i18n catalog.

Conventions this feature adds:

- **Generated-artifact discipline**: `src/templates/*.json` are build
  artifacts of `scripts/make-templates.ts`. Never hand-edit them — change
  the generator and regenerate
  (`REGENERATE_TEMPLATES=1 pnpm vitest run tests/unit/templates-generator.spec.ts`).
  The generator must stay deterministic (sequential ids, fixed version
  stamp) so regeneration diffs are reviewable, and the parity spec enforces
  it.
- **Template content vs chrome i18n**: template *content* is bilingual
  inside the JSON using the model's language keys (`English (en)`,
  `French (fr)`); gallery *chrome* (titles, descriptions) uses
  `library.templates.*` catalog keys. Never mix the two mechanisms.
- **Precomputed gallery metadata must be honest**: registry
  `questionCount`/`preview` are literals (the docs load lazily) and are
  cross-checked against the loaded documents in
  `tests/unit/templates-registry.spec.ts`.
- **Outside documents pass `migrateDoc`**: bundled JSON counts as an
  outside source (it is versioned data on disk), so `load()` gates it
  exactly like archive imports.
- **Reactive-proxy hygiene**: anything headed for `structuredClone`
  (template docs) is held in `shallowRef`s, mirroring ImportDialog's
  pattern.
- **DB schema bumps**: new tables append a `this.version(n).stores({...})`
  block (v1 declaration stays); every bump ships an upgrade spec that opens
  the previous shape first via an injected `IDBFactory`.
