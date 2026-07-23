import { describe, expect, it } from 'vitest'

import {
  applyPrimeVueLocale,
  primeVueLocaleFor,
  registerPrimeVueConfig,
} from '../../src/i18n/primevue-locale'

describe('primevue-locale', () => {
  it('translates the aria catalog per locale', () => {
    expect(primeVueLocaleFor('en').aria?.close).toBe('Close')
    expect(primeVueLocaleFor('fr').aria?.close).toBe('Fermer')
    expect(primeVueLocaleFor('es').aria?.close).toBe('Cerrar')
  })

  it('falls back to English for unknown locale codes', () => {
    expect(primeVueLocaleFor('xx')).toBe(primeVueLocaleFor('en'))
  })

  it('keeps non-aria fields on PrimeVue English defaults in every locale', () => {
    // Deliberate scope: only `aria` is translated (see the module header).
    expect(primeVueLocaleFor('fr').dayNames).toEqual(primeVueLocaleFor('en').dayNames)
    expect(primeVueLocaleFor('es').monthNames).toEqual(primeVueLocaleFor('en').monthNames)
  })

  it('applyPrimeVueLocale swaps the registered reactive config locale', () => {
    const config = { locale: primeVueLocaleFor('en') }
    registerPrimeVueConfig(config)
    applyPrimeVueLocale('es')
    expect(config.locale?.aria?.close).toBe('Cerrar')
    applyPrimeVueLocale('en')
    expect(config.locale?.aria?.close).toBe('Close')
  })
})
