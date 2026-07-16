// @vitest-environment happy-dom
// Focused unit coverage for useEmbedStore().applyConfig's theme/accent/contrast
// side effect: it must call setEmbedTheme with whichever of the three
// appearance dimensions were actually sent, and NOT gate the call on only
// theme/accent being present — a contrast-only set-config must reach
// setEmbedTheme too. (The end-to-end postMessage path is covered by
// tests/component/embed-bridge.spec.ts; this spec isolates just the store's
// own conditional so a regression here doesn't need the whole bridge.)
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setEmbedTheme } from '@/theme'

import { useEmbedStore } from './embed'

vi.mock('@/theme', () => ({ setEmbedTheme: vi.fn() }))
vi.mock('@/i18n/setLocale', () => ({ setLocale: vi.fn() }))

const mockedSetEmbedTheme = vi.mocked(setEmbedTheme)

describe('embed store applyConfig → setEmbedTheme', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockedSetEmbedTheme.mockClear()
  })

  it('calls setEmbedTheme with theme + accent when both are sent', () => {
    useEmbedStore().applyConfig({ theme: 'dark', accent: 'teal' })
    expect(mockedSetEmbedTheme).toHaveBeenCalledWith({ theme: 'dark', accent: 'teal', contrast: undefined })
  })

  it('calls setEmbedTheme for a contrast-only set-config, without needing theme/accent present too', () => {
    useEmbedStore().applyConfig({ contrast: 'high' })
    expect(mockedSetEmbedTheme).toHaveBeenCalledWith({ theme: undefined, accent: undefined, contrast: 'high' })
  })

  it('does not call setEmbedTheme when none of theme/accent/contrast are sent', () => {
    useEmbedStore().applyConfig({ locale: 'fr' })
    expect(mockedSetEmbedTheme).not.toHaveBeenCalled()
  })

  it('passes all three dimensions through together', () => {
    useEmbedStore().applyConfig({ theme: 'light', accent: 'rose', contrast: 'system' })
    expect(mockedSetEmbedTheme).toHaveBeenCalledWith({ theme: 'light', accent: 'rose', contrast: 'system' })
  })
})
