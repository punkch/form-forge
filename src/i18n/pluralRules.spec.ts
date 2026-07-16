import { afterEach, describe, expect, it } from 'vitest'

import { i18n } from './index'
import { fr } from './locales/fr'
import { frPluralRule } from './pluralRules'

describe('frPluralRule', () => {
  it('maps count 0 of a 2-form message to the singular index (0)', () => {
    expect(frPluralRule(0, 2, undefined)).toBe(0)
  })

  it('leaves count 1 of a 2-form message at the singular index (0), unchanged from default', () => {
    expect(frPluralRule(1, 2, undefined)).toBe(0)
  })

  it('leaves a count above 1 of a 2-form message at the plural index (1), unchanged', () => {
    expect(frPluralRule(5, 2, undefined)).toBe(1)
  })

  it('defers to orgRule for a 3-form message, unaffected by the fr override', () => {
    const orgRule = (c: number): number => (c === 0 ? 0 : c === 1 ? 1 : 2)
    expect(frPluralRule(0, 3, orgRule)).toBe(0)
  })

  describe('wired into the real i18n instance', () => {
    afterEach(() => {
      i18n.global.locale.value = 'en'
    })

    it('renders the fr catalog singular form (not plural) for a real 2-form key at count 0', () => {
      i18n.global.locale.value = 'fr'

      const [singular] = fr.common.errorCount.split('|').map((form) => form.trim())
      expect(i18n.global.t('common.errorCount', 0)).toBe(singular.replace('{count}', '0'))
    })
  })
})
