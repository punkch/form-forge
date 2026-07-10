import { i18n } from './index'

const textDirection = (locale: string): 'rtl' | 'ltr' =>
  locale.startsWith('ar') ? 'rtl' : 'ltr'

/**
 * Switches the active UI locale and keeps the document element in sync
 * (`lang` for assistive tech / font selection, `dir` for RTL locales such as
 * Arabic). English is the only shipped locale today; this is the single
 * entry point future language switching goes through.
 */
export const setLocale = (locale: string): void => {
  i18n.global.locale.value = locale as typeof i18n.global.locale.value
  document.documentElement.lang = locale
  document.documentElement.dir = textDirection(locale)
}
