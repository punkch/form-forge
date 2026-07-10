# Standards — In-App Help System

Follows the project standards from
`docs/specs/2026-07-09-1602-product-docs-and-foundation/standards.md`
(strict TypeScript, neostandard ESLint, Composition API `<script setup>`,
Vitest + Playwright patterns) and the i18n conventions from
`docs/specs/2026-07-09-2352-ui-i18n-foundation/` (all UI strings through
`t()` with keys in a per-namespace JSON file).

Conventions this feature adds for future help work:

- **Help prose lives in the catalog, indexed by typed maps.** New help
  content goes into `src/i18n/locales/en/help.json` plus a literal
  `MessageKey` entry in `src/help/content.ts` — never a raw string in a
  component and never a runtime-built key. vue-tsc then proves the key
  exists.
- **`docsAnchor` values must be real.** A bare value must be an actual
  section id on `docs.getodk.org/form-question-types/`; anything else is an
  absolute URL. `tests/unit/help-content.spec.ts` enforces presence;
  correctness is verified against the live page when anchors are added.
- **Type-detail rendering goes through `QuestionTypeHelpContent.vue`.**
  Surfaces that show a type's help (drawer, reference, anything future)
  compose that component instead of re-rendering registry tables.
- **Type search goes through `matchesTypeSearch`** (`src/help/search.ts`);
  the palette and reference must not grow divergent matching rules.
- **Field help affordances use `HelpPopover.vue`** with a `HelpFieldKey`;
  adding a new property field means adding its `fieldHelp` + catalog entry
  first (the union type makes call sites fail to compile otherwise).
