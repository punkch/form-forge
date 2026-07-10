# UI i18n Foundation — Manual Verification

The scaffold changes no visible UI (English-only, no switcher yet), so
verification is mostly developer-facing.

| # | Steps | Expected |
|---|---|---|
| 1 | `pnpm dev`, open the app, browse the library and an editor | Everything renders exactly as before; no console errors or vue-i18n warnings |
| 2 | Inspect `<html>` in devtools | `lang="en"` and `dir="ltr"` are set on load |
| 3 | In devtools console: `localStorage.getItem('odk-builder:ui:v1')` | Payload contains `"locale":"en"` after any UI-pref change (e.g. resize a panel) |
| 4 | Temporarily call `setLocale('ar')` from a dev component (or edit the persisted `locale` to `"ar"` and reload) | `<html lang="ar" dir="rtl">`; app still renders (strings stay English via fallback); restore to `en` afterwards |
| 5 | Add `{{ $t('common.doesNotExist') }}` to any component under `src/components/`, run `pnpm lint` | `@intlify/vue-i18n/no-missing-keys` error; remove the line |
| 6 | In a component, `const { t } = useAppI18n()` then `t('common.doesNotExist')`, run `pnpm typecheck` | vue-tsc error (key not in `MessageKey`); remove the line |
| 7 | `pnpm vitest run` | All green, including `tests/component/i18n-smoke.spec.ts` |
| 8 | Add a hardcoded string to a component template, run `pnpm lint` | A `no-raw-text` **warning** appears (burn-down guard), lint still exits 0 |
