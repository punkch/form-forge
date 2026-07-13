import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  accentPrimary500,
  generateAccentsCss,
  generateThemeDarkCss,
} from '../../scripts/theme-css-lib.mjs'
import {
  extractDarkModeSelector,
  readBundleSources,
} from '../../scripts/webforms-bundle-lib.mjs'
import { ACCENTS } from '../../src/theme/constants'

const root = fileURLToPath(new URL('../..', import.meta.url))
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8')

describe('generated theme CSS drift guards', () => {
  it('theme-dark.css is byte-identical to generateThemeDarkCss()', () => {
    expect(read('src/styles/generated/theme-dark.css')).toBe(generateThemeDarkCss())
  })

  it('theme-accents.css is byte-identical to generateAccentsCss()', () => {
    expect(read('src/styles/generated/theme-accents.css')).toBe(generateAccentsCss())
  })

  it('accentPrimary500() matches every hex500 swatch in ACCENTS', () => {
    const rendered = accentPrimary500()
    for (const accent of ACCENTS) {
      expect(rendered[accent.id], `accent ${accent.id}`).toBe(accent.hex500)
    }
  })

  it('web-forms installs PrimeVue with darkModeSelector:false', () => {
    expect(extractDarkModeSelector(readBundleSources())).toBe('false')
  })
})
