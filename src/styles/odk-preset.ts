import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

/**
 * Byte-identical to the odkThemePreset bundled inside @getodk/web-forms 1.0.0
 * (ODK blue primary scale + slate surfaces). Keeping the host preset identical
 * makes the duplicate :root { --p-* } injections idempotent, so the bundled
 * PrimeVue inside web-forms cannot cause visual drift.
 * Guarded by tests/unit/theme-parity.spec.ts.
 */
export const ODK_PRIMARY_SCALE = {
  50: '#e9f8ff',
  100: '#c7e6f5',
  200: '#a5d4eb',
  300: '#82c3e0',
  400: '#60b1d6',
  500: '#3e9fcc',
  600: '#3488af',
  700: '#297193',
  800: '#1f5976',
  900: '#14425a',
  950: '#0a2b3d',
} as const

export const odkPreset = definePreset(Aura, {
  semantic: {
    primary: ODK_PRIMARY_SCALE,
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff',
          50: '{slate.50}',
          100: '{slate.100}',
          200: '{slate.200}',
          300: '{slate.300}',
          400: '{slate.400}',
          500: '{slate.500}',
          600: '{slate.600}',
          700: '{slate.700}',
          800: '{slate.800}',
          900: '{slate.900}',
          950: '{slate.950}',
        },
      },
    },
  },
})
