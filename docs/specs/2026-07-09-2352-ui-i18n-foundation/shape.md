# F4 — UI i18n Foundation — Shaping Notes

## Scope

Scaffold only: typed vue-i18n runtime, per-namespace English catalog,
locale/RTL plumbing, persistence, test wiring, and the eslint guard.
**No strings are extracted in this phase** — user-visible English text
stays byte-identical and `data-testid`s untouched, so all existing
component and e2e assertions pass unchanged. Extraction happens
area-by-area afterwards (see plan.md Phase 2).

## Decisions

- **UI chrome i18n ≠ form-content translations.** The existing
  TranslationsDialog feature translates the *forms being built*
  (`jr:itext`), lives in `src/core`/`src/components/translations`, and is
  untouched. The new `src/i18n/` tree only localizes the builder itself.
- **Per-namespace JSON files, namespace as the file's top-level key.**
  One file per app area (`common`, `shell`, `library`, `palette`,
  `canvas`, `properties`, `preview`, `dialogs`, `importExport`,
  `settings`) so parallel extraction agents never touch the same file.
  Each file wraps its keys in its namespace
  (`{ "palette": { … } }`) because @intlify/eslint-plugin-vue-i18n loads
  locale resources straight from disk and merges all of a locale's files
  at the root — with flat files it would look for `palette.addQuestion`
  at each file's root and report every key missing. The wrapper makes the
  on-disk shape identical to the runtime shape (index.ts just spreads).
- **`createI18n<{ message: MessageSchema }, 'en', false>`** — the third
  generic (`Legacy = false`) is required: with only two generics vue-i18n
  types the instance as legacy and `i18n.global.locale` loses its `.value`
  ref shape.
- **Own strict `t` layer (`useAppI18n`, `translate`, `MessageKey`)** —
  probing showed vue-i18n 11's `t`/`$t` signatures are
  `<Key extends string>(key: Key | ResourceKeys …)`: the
  `DefineLocaleMessage` augmentation feeds autocomplete but **any string
  literal compiles**, in scripts and templates alike (verified with
  throwaway probe files against `vue-tsc -b --force`; no strictness knob
  exists in the shipped types). Since "bad keys fail vue-tsc" is the
  acceptance bar, `src/i18n/index.ts` exports a `StrictTranslate` cast of
  the same global `t` whose key parameter is the `MessageKey` path union.
  vue-tsc checks template expressions against `<script setup>` bindings,
  so a `t` from `useAppI18n()` is strict in templates too; raw `$t` stays
  covered by the eslint `no-missing-keys` error.
- **Locale pref lives in the ui store** (existing localStorage payload,
  same version — the field is optional on read, so no migration), applied
  once in `main.ts` via `setLocale` before mount. The store stays i18n-
  agnostic; `setLocale` stays store-agnostic; main.ts wires them.
- **`dir` derived from the locale prefix** (`ar*` → rtl) inside
  `setLocale` — the single choke point future languages go through.
- **`no-missing-keys` = error on all of `src/`** (it only fires on i18n
  call sites, so it is free elsewhere); **`no-raw-text` = warn scoped to
  `src/components/**` + `src/views/**`** — it is the extraction burn-down
  list, and scoping keeps core/stores/tests quiet. Warnings do not fail
  `pnpm lint` (no `--max-warnings`), so CI stays green during extraction.
- **Shared i18n instance in component-test setup** (like PrimeVue),
  not per-test: tests keep asserting English and gain `$t` for free.
- **`src/core/` never imports the i18n runtime** — validator/serializer
  issues carry stable `code`s; the UI localizes by code in a later step.

## Considered and rejected

- Single `en.json` catalog file — guaranteed merge conflicts across the
  parallel extraction agents; per-locale dir split would be needed at
  language #2 anyway (backlog note), so start split.
- Flat per-namespace files + namespaces assigned in index.ts — breaks the
  eslint plugin's key resolution (see above); rejected in favor of the
  namespace-wrapped file shape.
- Bumping the ui-store storage version for the new `locale` field — the
  reader already treats every field as optional; a bump would discard
  users' saved panel widths for nothing.
- `.vue` fixture for the smoke test — `tests/**/*.vue` is outside the
  tsconfig include; a render-function component exercises the same typed
  `useI18n().t` path without touching the build config.

## Out of scope

- String extraction (Phase 2), logical-property CSS conversion (Phase 3),
  language switcher UI, PrimeVue `primelocale` wiring, localizing core
  validation messages by code (all follow-ups in plan.md).
