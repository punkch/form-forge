import { createI18n, useI18n } from 'vue-i18n'

import { en } from './locales/en'
import { es } from './locales/es'
import { fr } from './locales/fr'
import { frPluralRule } from './pluralRules'

/**
 * Shape of the UI message catalog. English is the source of truth; additional
 * locales must satisfy this schema so vue-tsc catches missing/bad keys.
 */
export type MessageSchema = typeof en

type NestedKey<T> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? `${K}.${NestedKey<T[K]>}`
    : K
}[keyof T & string]

/** Every dotted key path of the catalog: 'common.cancel' | 'common.save' | … */
export type MessageKey = NestedKey<MessageSchema>

/**
 * `t` restricted to catalog keys. vue-i18n 11 types its own `t`/`$t` keys as
 * autocomplete-only (`Key extends string` accepts any string), so this alias
 * is what makes an unknown key a vue-tsc error.
 */
export interface StrictTranslate {
  (key: MessageKey): string
  (key: MessageKey, plural: number): string
  (key: MessageKey, named: Record<string, unknown>): string
  (key: MessageKey, named: Record<string, unknown>, plural: number): string
}

/**
 * The locale union the app ships full catalogs for — the single source of
 * truth consumers must derive from (createI18n below, the PrimeVue aria map
 * in primevue-locale.ts), so adding a locale here breaks every site that
 * hasn't caught up yet instead of drifting silently.
 */
export type AppLocale = 'en' | 'fr' | 'es'

/**
 * UI-chrome i18n instance (Composition API mode). This is distinct from the
 * form-content translations feature (TranslationsDialog), which translates
 * the *forms being built*, not the builder itself.
 */
export const i18n = createI18n<{ message: MessageSchema }, AppLocale, false>({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en, fr, es },
  pluralRules: { fr: frPluralRule },
})

/**
 * Native display names for the UI locales the app knows how to label. What is
 * actually selectable derives from `i18n.global.availableLocales` (see
 * `localeOptions`), so registering a catalog — e.g. a test catalog via
 * `i18n.global.setLocaleMessage` — is what adds an option; this map only
 * supplies its human name.
 */
export const SUPPORTED_LOCALES: Record<string, string> = { en: 'English', fr: 'Français', es: 'Español' }

/** Options for the app-language picker: every registered catalog, labeled by native name when known. */
export const localeOptions = (): { code: string, label: string }[] =>
  i18n.global.availableLocales.map((code) => ({ code, label: SUPPORTED_LOCALES[code] ?? code }))

/**
 * Preferred way to translate in components: `const { t } = useAppI18n()`.
 * Same global-scope composer as `useI18n()`, but `t` only accepts existing
 * catalog keys — including when called from templates, which vue-tsc checks
 * against setup bindings. (`$t` stays available but is guarded by ESLint
 * `no-missing-keys` only.)
 */
export const useAppI18n = (): { t: StrictTranslate } => {
  const { t } = useI18n<{ message: MessageSchema }, 'en'>({ useScope: 'global' })
  return { t: t as StrictTranslate }
}

/** Strict `t` for module/store code that runs outside a component setup. */
export const translate = i18n.global.t as StrictTranslate
