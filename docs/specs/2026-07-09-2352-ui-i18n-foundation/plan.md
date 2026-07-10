# F4 — UI i18n Foundation — Plan

## Problem

Every builder UI string is hardcoded English inline (34 SFCs, ~250–350
strings). Target users work in French, Spanish, Arabic, Russian and more;
the UI chrome must be translatable and Arabic needs right-to-left layout.
This is **distinct from the form-content translations feature**
(TranslationsDialog), which translates the forms being built and stays
untouched.

## Phase 1 — scaffold (this spec)

### Runtime

- `vue-i18n@^11`, Composition API mode:
  `createI18n<{ message: MessageSchema }, 'en', false>({ legacy: false,
  globalInjection: true, locale: 'en', fallbackLocale: 'en', messages: { en } })`
  in `src/i18n/index.ts`. Installed in `src/main.ts` before mount.
- Vite `define` sets the vue-i18n esm-bundler feature flags
  (`__VUE_I18N_LEGACY_API__: false`, full install, keep the message
  compiler since the catalog is plain JSON).

### Catalog layout

- `src/i18n/locales/en/*.json` — **one file per app area** so parallel
  extraction agents never collide: `common`, `shell`, `library`,
  `palette`, `canvas`, `properties`, `preview`, `dialogs`,
  `importExport`, `settings`.
- Each file carries its namespace as its **single top-level key**
  (`common.json` = `{ "common": { "cancel": "Cancel", … } }`). This exact
  on-disk shape is what `@intlify/eslint-plugin-vue-i18n` loads for
  `no-missing-keys` (the plugin merges all files of a locale; it has no
  per-file-namespace concept), so the runtime catalog and the lint
  catalog can never drift.
- `src/i18n/locales/en/index.ts` spreads the files into a single `en`
  object whose top-level keys are the namespaces.

### Typed keys

- `export type MessageSchema = typeof en` (`resolveJsonModule` on;
  `src/**/*.json` added to `tsconfig.app.json` include for the composite
  build).
- `src/i18n/schema.d.ts` augments vue-i18n's `DefineLocaleMessage` with
  `MessageSchema` (IDE autocomplete for `$t`/`useI18n`).
- **Verified limitation**: vue-i18n 11 deliberately types its `t`/`$t`
  keys as `Key extends string` — any string compiles; the schema only
  powers autocomplete. Compile-time failure therefore comes from our own
  strict layer in `src/i18n/index.ts`:
  - `MessageKey` — union of every dotted catalog key path;
  - `useAppI18n()` — global-scope composer whose `t` only accepts
    `MessageKey`. A `t` bound in `<script setup>` **is** type-checked
    inside templates by vue-tsc, so bad keys fail there too (locked in by
    a `@ts-expect-error` probe in `tests/component/i18n-smoke.spec.ts`);
  - `translate` — same strict `t` for module/store code.
  - Raw `$t(...)` in templates stays possible; it is guarded by the
    ESLint `no-missing-keys` **error** instead (verified to fire inside
    templates).

### Locale switching plumbing (no UI yet)

- `src/i18n/setLocale.ts` — the single entry point: sets
  `i18n.global.locale`, `document.documentElement.lang`, and
  `document.documentElement.dir` (`rtl` for locales starting with `ar`,
  else `ltr`).
- `locale` preference (default `'en'`) persisted in the `ui` store's
  existing localStorage payload; `main.ts` applies it via `setLocale`
  before mount. English-only today; no switcher UI until language #2.

### Guard rails

- ESLint (flat config): `@intlify/vue-i18n/no-missing-keys` = **error**
  on `src/**/*.{ts,vue}`; `@intlify/vue-i18n/no-raw-text` = **warn** on
  `src/components/**` and `src/views/**` (the burn-down list for
  extraction). `localeDir` = `{ pattern: 'src/i18n/locales/*/*.json',
  localeKey: 'path' }` with a locale-capturing path regex.
- Tests: the i18n instance is installed once in
  `tests/setup/component.ts`, so every component test gets `$t`/`useI18n`
  while existing tests keep asserting the same English strings.
- Smoke test `tests/component/i18n-smoke.spec.ts`: a component rendering
  `t('common.cancel')` resolves "Cancel"; `setLocale('ar')` flips
  `<html lang dir>` to `ar`/`rtl` and back.

## Phase 2 — per-area string extraction (follow-up commits)

One commit per area, in dependency-light order:
shell → library → palette → canvas → properties → preview → dialogs →
importExport → settings. Rules for extractors:

- Extracted English values must stay **byte-identical** (component and
  e2e tests assert them); `data-testid` attributes never change.
- Components use `const { t } = useAppI18n()` and call `t('ns.key')` in
  script and template (compile-time-checked keys); store- or module-level
  strings use `translate` from `@/i18n` — **never** in `src/core/`
  (validator/serializer issues carry stable `code`s; the UI localizes by
  code in a later step).
- Interpolations use named params (`{name}`), plurals use vue-i18n plural
  forms; no string concatenation of translated fragments.
- Each area only touches its own namespace JSON + its own components, so
  areas can be extracted in parallel without merge conflicts.
- `no-raw-text` warnings for the area drop to zero when its extraction
  lands; when all areas are done, promote `no-raw-text` to `error`.

## Phase 3 — RTL readiness

- Convert physical CSS properties to logical ones in builder styles
  (~26 occurrences: `margin-left` → `margin-inline-start`,
  `left/right` → `inset-inline-*`, `text-align: left` →
  `text-align: start`, border/padding likewise). No LTR visual change.
- Panel-resize math (splitter deltas) must respect `dir` — audit
  `useResizablePanel`-style code paths when flipping.
- Acceptance: flipping to a pseudo-RTL locale in dev flips `dir` without
  layout breakage (the `ar` prefix rule in `setLocale` already plumbs
  `dir`).

## Phase 4 — future-language playbook (language #2, e.g. French)

1. Add `src/i18n/locales/fr/` mirroring the `en` per-namespace files
   (the per-locale directory split already exists — just add a sibling
   dir; the eslint `localeDir` pattern `locales/*/*.json` picks it up,
   and `no-missing-keys-in-other-locales` can then be enabled).
2. Type the new locale against the schema:
   `messages: { en, fr: fr satisfies MessageSchema }` (vue-tsc then
   reports missing/extra keys in `fr`).
3. Add the `primelocale` package and wire PrimeVue's locale in
   `setLocale` (`primevue.config.locale = primelocale[locale]`) so
   PrimeVue-internal strings (datepicker, filter menus, aria labels)
   switch too.
4. Lazy-load non-default catalogs
   (`const { fr } = await import('./locales/fr')` +
   `i18n.global.setLocaleMessage('fr', fr)`) before calling `setLocale`.
5. Ship the language switcher UI (Settings dialog), writing
   `ui.locale` and calling `setLocale`; persistence already works.
6. If the language is RTL beyond Arabic (e.g. Hebrew), extend
   `textDirection()`'s prefix list (`ar`, `he`, `fa`, `ur`).

## Verification

- `pnpm typecheck`, `pnpm lint` (0 errors; `no-raw-text` warnings are the
  extraction burn-down), `pnpm vitest run` green (e2e run by the
  orchestrator).
- Negative checks (performed with throwaway probe files, then removed):
  `useAppI18n()`/`translate` with `'common.doesNotExist'` fails
  `vue-tsc`; `$t('common.doesNotExist')` in a component template fails
  `pnpm lint` with `@intlify/vue-i18n/no-missing-keys`, while
  `$t('common.cancel')` resolves cleanly (namespaced per-file catalog is
  read correctly).
