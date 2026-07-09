# UI internationalization — shaping (scheduled)

## Problem

Every builder UI string is hardcoded English inline (34 SFCs, ~250–350
strings). The product targets NGO/agency field teams working in French,
Spanish, Arabic, Russian and more; the UI chrome must be translatable, and
Arabic requires right-to-left layout. This is distinct from the existing
**form-content** translations feature (TranslationsDialog), which stays
untouched.

## Scope

- vue-i18n foundation with a typed English catalog; English is the only
  shipped language for now.
- All UI strings extracted to the catalog; new components use `t()` from
  day one.
- RTL readiness: `<html lang dir>` switching plumbed, physical CSS
  properties converted to logical ones now (26 occurrences, no LTR visual
  change); language switcher UI deferred until a second language exists.

## Approach

- `vue-i18n@^11`, `legacy: false`, `globalInjection: true`;
  `src/i18n/index.ts` + single `src/i18n/locales/en.json` namespaced by
  feature (split into per-locale directories when language #2 lands).
- Typed keys: `type MessageSchema = typeof en` + `DefineLocaleMessage`
  augmentation so bad keys fail vue-tsc, including in templates.
- `setLocale.ts` sets locale, `<html lang dir>` (`rtl` for `ar`), PrimeVue
  locale (add the `primelocale` package at language #2); locale persisted
  in the ui store.
- Extraction one commit per area (shell → library → palette/canvas →
  properties → preview → dialogs → stores); store-side strings via
  `i18n.global.t`.
- Guard: `@intlify/eslint-plugin-vue-i18n` — `no-missing-keys` = error,
  `no-raw-text` = warn.

## Decisions

- Core validator/serializer messages stay English: issues carry stable
  `code`s and the UI localizes by code (future step); pure `src/core/`
  never imports the i18n runtime.
- i18n installed once in `tests/setup/component.ts` so existing tests keep
  asserting English strings unchanged.

## Acceptance

vue-tsc fails on a bad message key; lint fails on a missing key; existing
component + e2e suites pass unchanged after extraction; flipping locale to
a pseudo-RTL locale in dev flips `dir` without layout breakage.
