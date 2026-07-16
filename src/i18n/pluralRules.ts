import type { PluralizationRule } from 'vue-i18n'

/**
 * French treats a zero count as grammatically singular ("0 erreur", not
 * "0 erreurs"), unlike vue-i18n's default rule, which maps a 2-form
 * message's count 0 to the plural form (correct for English: "0
 * errors"). This only overrides that one case — a 2-form message
 * (`choicesLength === 2`) at `choice === 0` — and defers to the built-in
 * rule (`orgRule`) for every other count and every other message shape,
 * so 3-form messages (which already carry a distinct zero-count wording
 * under the default rule, e.g. "no forms found. | 1 form found. | …")
 * are untouched.
 */
export const frPluralRule: PluralizationRule = (choice, choicesLength, orgRule) => {
  if (choicesLength === 2 && choice === 0) return 0
  return orgRule ? orgRule(choice, choicesLength) : choice === 1 ? 0 : 1
}
