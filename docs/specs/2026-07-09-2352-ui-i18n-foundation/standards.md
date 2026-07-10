# Standards — UI i18n Foundation

Follows the existing project standards
(`docs/specs/2026-07-09-1602-product-docs-and-foundation/standards.md`:
strict TypeScript, neostandard ESLint, Composition API `<script setup>`,
Vitest patterns). New conventions introduced by this spec:

## Message catalog

- One JSON file per app-area namespace under
  `src/i18n/locales/<locale>/`; the file's **single top-level key is its
  namespace** and must match the file name
  (`palette.json` → `{ "palette": { … } }`).
- Key style: camelCase leaves, nested objects per sub-area when a
  namespace grows (`properties.validation.title`). Values are plain
  strings with vue-i18n named interpolation (`{name}`) and `|` plurals.
- New namespaces: add the JSON file, import + spread it in
  `locales/en/index.ts`. Never rename existing keys casually — they are
  API for translators.

## Using translations

- Components: `const { t } = useAppI18n()` (from `@/i18n`) and call
  `t('ns.key')` in script and template — keys are compile-checked.
- Module/store code: `translate('ns.key')` from `@/i18n`.
- `$t` (global injection) works but is only lint-checked; prefer `t`.
- `src/core/` must never import `@/i18n` — core issues carry stable
  `code`s and the UI localizes by code.
- Never build sentences by concatenating translated fragments; use
  interpolation params instead.

## Locale switching

- All locale changes go through `setLocale()` (`src/i18n/setLocale.ts`)
  so `<html lang dir>` never desyncs; the persisted preference lives in
  the `ui` store (`ui.locale`).

## Guard rails

- `@intlify/vue-i18n/no-missing-keys` is an **error** — a bad key fails
  `pnpm lint`.
- `@intlify/vue-i18n/no-raw-text` is a **warn** on `src/components/**`
  and `src/views/**` — the extraction burn-down list. Do not add new
  hardcoded UI strings; promote the rule to error once extraction
  completes.
- English string values asserted by existing tests must stay
  byte-identical during extraction; `data-testid` attributes never
  change.
