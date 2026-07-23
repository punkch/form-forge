import { i18n } from './index'
import { applyPrimeVueLocale } from './primevue-locale'

const textDirection = (locale: string): 'rtl' | 'ltr' =>
  locale.startsWith('ar') ? 'rtl' : 'ltr'

/**
 * Switches the active UI locale and keeps the document element in sync
 * (`lang` for assistive tech / font selection, `dir` for RTL locales such as
 * Arabic). English is the only shipped locale today; this is the single
 * entry point future language switching goes through. Also re-applies
 * PrimeVue's own locale (`config.locale.aria`) so built-in controls'
 * accessible names — Dialog/Drawer close buttons and the like — follow the
 * same switch, including for whatever is already open (PrimeVue's config is
 * reactive).
 */
export const setLocale = (locale: string): void => {
  i18n.global.locale.value = locale as typeof i18n.global.locale.value
  document.documentElement.lang = locale
  document.documentElement.dir = textDirection(locale)
  applyPrimeVueLocale(locale)
}
