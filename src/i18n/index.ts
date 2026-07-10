import { createI18n, useI18n } from 'vue-i18n'

import { en } from './locales/en'

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
 * UI-chrome i18n instance (Composition API mode). This is distinct from the
 * form-content translations feature (TranslationsDialog), which translates
 * the *forms being built*, not the builder itself.
 */
export const i18n = createI18n<{ message: MessageSchema }, 'en', false>({
  legacy: false,
  globalInjection: true,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en },
})

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
