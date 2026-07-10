# Standards — Entities Advanced

Follows the existing project standards
(`docs/specs/2026-07-09-1602-product-docs-and-foundation/standards.md`:
strict TypeScript, neostandard ESLint, Composition API `<script setup>`,
Vitest + Playwright patterns) and the i18n conventions
(`docs/specs/2026-07-09-2352-ui-i18n-foundation/`).

Conventions this slice adds or reinforces:

- **Goldens before serializer code** (the Spec 04 method): any change to
  what `serializeXForm` emits starts by adding a pyxform-generated fixture
  and only then touching the emitter. Edge cases that don't warrant a
  fixture are probed with throwaway scripts (kept out of the repo) and the
  findings recorded in the spec's shape.md.
- **Serializer and parser speak the same dialect**: whatever entity
  construct `serializeXForm` emits, `parseXForm` must fold back into the
  model — `roundtrip.spec.ts` enforces this for every golden
  automatically, so the two files change together.
- **Derived XML state is never modeled**: `baseVersion`/`trunkVersion`/
  `branchId` binds are computed from `entityId` on export and dropped on
  import; only author intent (`EntityDeclaration`, `saveTo`) is stored.
- **Validation severity mirrors pyxform**: what pyxform rejects is an
  error; what it accepts but is probably wrong is a warning. Issue codes
  stay namespaced (`entities.*`) with plain-English messages (core is not
  i18n-ized).
- **Multi-step authoring actions are one `mutate()`** so they undo as one
  step (follow-up wizard), composing `createNode`/`insertNode`/
  `uniqueName` from `core` inside a single callback.
- **Dialog → canvas navigation** goes through the editor store's
  `select()` + `revealNodeId`, never direct DOM scrolling.
- **Shared i18n catalogs get additive edits only**; keys are namespaced
  per feature (`settings.entities.*`, `properties.entity.*`).
