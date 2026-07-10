# Standards — External Dataset Tooling

Follows the existing project standards
(`docs/specs/2026-07-09-1602-product-docs-and-foundation/standards.md`:
strict TypeScript, neostandard ESLint, Composition API `<script setup>`,
Vitest + Playwright patterns), the i18n conventions
(`docs/specs/2026-07-09-2352-ui-i18n-foundation/`) and the F3a attachment
convention (uploads go through `useAttachmentUpload().attachFile()`).

Conventions this slice adds or reinforces:

- **`xlsx` imports stay confined to `workbook-read.ts`/`workbook-write.ts`**.
  Any new format reading (here: CSV text) gets a function on the adapter,
  not a new import site.
- **`src/core/` stays pure**: `datasets/parse.ts` and
  `validate/datasets.ts` take data in, return data out — no Vue/Pinia/
  Dexie, no async. Anything that must touch blobs or debounce lives in the
  form store.
- **Async validation inputs travel through `ValidateContext`**: when a
  future validator needs environment facts (parsed files, remote state),
  extend the context object instead of making `validateDocument` async or
  stateful.
- **Issue codes are namespaced** (`dataset.*`) and validator messages are
  plain English strings like the rest of `src/core/validate/` (core is not
  i18n-ized; UI chrome strings are).
- **Unknown means silent**: validators must not warn from ignorance —
  unparseable (`null`) column sets produce no issues. Only positive
  knowledge (parsed columns that lack the referenced name) warns.
- **Testids are stable contracts**: the value/label inputs keep
  `prop-param-value`/`prop-param-label` whether they render as InputText
  or as the upgraded editable Select, so tests and tours survive the
  progressive enhancement.
