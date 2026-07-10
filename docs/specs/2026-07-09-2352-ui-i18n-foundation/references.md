# References — UI i18n Foundation

## Files added

- `src/i18n/index.ts` — typed `createI18n` instance (`MessageSchema`,
  `MessageKey`, `StrictTranslate`, `useAppI18n`, `translate`).
- `src/i18n/schema.d.ts` — `DefineLocaleMessage` augmentation
  (autocomplete for `$t`/`useI18n`).
- `src/i18n/setLocale.ts` — locale + `<html lang dir>` switching
  (`ar*` → `rtl`).
- `src/i18n/locales/en/{common,shell,library,palette,canvas,properties,preview,dialogs,importExport,settings}.json`
  — per-namespace catalog files, each wrapping its keys in its namespace
  key; starter keys in `common` only.
- `src/i18n/locales/en/index.ts` — spreads the namespace files into the
  `en` catalog object.
- `tests/component/i18n-smoke.spec.ts` — plugin wiring smoke test +
  `@ts-expect-error` bad-key probe + `setLocale` lang/dir test.

## Files changed

- `package.json` — `vue-i18n@^11` (dep),
  `@intlify/eslint-plugin-vue-i18n` (dev dep).
- `src/main.ts` — `app.use(i18n)` before mount; applies the persisted
  `ui.locale` via `setLocale` before mount.
- `src/stores/ui.ts` — persisted `locale` pref (default `'en'`), same
  storage version (field optional on read).
- `tests/setup/component.ts` — installs the shared i18n instance into
  `@vue/test-utils` global config (next to PrimeVue).
- `eslint.config.js` — `@intlify/vue-i18n` plugin; `no-missing-keys` =
  error on `src/**/*.{ts,vue}`, `no-raw-text` = warn on
  `src/components/**` + `src/views/**`; `localeDir` pattern
  `src/i18n/locales/*/*.json` with `localeKey: 'path'`.
- `tsconfig.app.json` — `resolveJsonModule: true`; `src/**/*.json` added
  to `include` (composite builds must list imported JSON).
- `vite.config.ts` — vue-i18n esm-bundler feature-flag `define`s.

## Files consulted (unchanged)

- `docs/specs/backlog/ui-i18n.md` — the shaped backlog note this spec
  implements (single `en.json` idea superseded by per-namespace files).
- `src/components/translations/**`, `src/stores/form.ts` — form-content
  translations feature; confirmed fully separate, untouched.
- `tests/component/helpers.ts`, `tests/component/save-indicator.spec.ts`
  — component-test patterns (mount options, English string assertions).
- `node_modules/vue-i18n/dist/vue-i18n.d.ts` — verified `t`/`$t` key
  typing is autocomplete-only (`Key extends string`), motivating the
  strict layer.
- `node_modules/@intlify/eslint-plugin-vue-i18n/dist/utils/*` — verified
  locale-resource loading: files merge per locale at each key-path level,
  which drives the namespace-as-top-level-key file shape and
  `localeKey: 'path'` settings.

## External docs

- vue-i18n v11 guide (Composition API, TypeScript schema support).
- @intlify/eslint-plugin-vue-i18n rule docs (`no-missing-keys`,
  `no-raw-text`, `settings['vue-i18n'].localeDir`).
