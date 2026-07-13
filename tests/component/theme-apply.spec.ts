// Theme apply-layer tests — happy-dom (real document/head). Covers applyTheme's
// attribute + browser-chrome-meta stamping and the embed-override precedence of
// the module controller. matchMedia is stubbed so scheme resolution is
// deterministic across happy-dom/jsdom.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import {
  applyTheme,
  initThemeController,
  setEmbedTheme,
  type AccentId,
  type ThemeScheme,
} from '@/theme'

const metaContent = (name: string): string | null =>
  document.head.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null

/**
 * Deterministic prefers-color-scheme with a capturable listener, so a test can
 * flip the OS scheme (`set`) and invoke the registered change handler (`fire`).
 */
const stubMatchMedia = (matches: boolean): { set: (v: boolean) => void, fire: () => void } => {
  let listener: (() => void) | null = null
  const mql = {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, cb: () => void) => { listener = cb },
    removeEventListener: () => { listener = null },
    addListener: (cb: () => void) => { listener = cb },
    removeListener: () => { listener = null },
    dispatchEvent: () => false,
  }
  vi.stubGlobal('matchMedia', () => mql)
  return { set: (v: boolean) => { mql.matches = v }, fire: () => listener?.() }
}

beforeEach(() => {
  for (const m of document.head.querySelectorAll('meta[name="color-scheme"], meta[name="theme-color"]')) {
    m.remove()
  }
  delete document.documentElement.dataset.ffTheme
  delete document.documentElement.dataset.ffAccent
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('applyTheme', () => {
  it('stamps the html attributes and creates the chrome metas when absent (light → accent hex)', () => {
    expect(metaContent('color-scheme')).toBeNull()

    applyTheme('light', 'green')

    const root = document.documentElement
    expect(root.dataset.ffTheme).toBe('light')
    expect(root.dataset.ffAccent).toBe('green')
    expect(metaContent('color-scheme')).toBe('light')
    // green's hex500 is the light-mode theme-color.
    expect(metaContent('theme-color')).toBe('#0f7c39')
  })

  it('uses the dark chrome surface for theme-color in dark', () => {
    applyTheme('dark', 'blue')

    const root = document.documentElement
    expect(root.dataset.ffTheme).toBe('dark')
    expect(root.dataset.ffAccent).toBe('blue')
    expect(metaContent('color-scheme')).toBe('dark')
    expect(metaContent('theme-color')).toBe('#0f172a')
  })

  it('renders the blue default accent hex in light', () => {
    applyTheme('light', 'blue')
    expect(metaContent('theme-color')).toBe('#3e9fcc')
  })

  it('updates an existing meta rather than duplicating it', () => {
    const pre = document.createElement('meta')
    pre.setAttribute('name', 'color-scheme')
    pre.setAttribute('content', 'light')
    document.head.appendChild(pre)

    applyTheme('dark', 'purple')

    const metas = document.head.querySelectorAll('meta[name="color-scheme"]')
    expect(metas.length).toBe(1)
    expect(metas[0].getAttribute('content')).toBe('dark')
  })
})

describe('initThemeController + setEmbedTheme precedence', () => {
  it('applies the ui source on init, then lets an embed override win', async () => {
    stubMatchMedia(false)
    const source = reactive<{ theme: ThemeScheme, accent: AccentId }>({ theme: 'light', accent: 'green' })

    initThemeController(source)

    const root = document.documentElement
    // Pre-mount apply reflects the ui-store preference.
    expect(root.dataset.ffTheme).toBe('light')
    expect(root.dataset.ffAccent).toBe('green')

    // Embed-host override takes precedence over the persisted preference.
    setEmbedTheme('dark', 'rose')
    expect(root.dataset.ffTheme).toBe('dark')
    expect(root.dataset.ffAccent).toBe('rose')

    // A later ui-source change must not dislodge the still-active override.
    source.theme = 'light'
    source.accent = 'blue'
    await nextTick()
    expect(root.dataset.ffTheme).toBe('dark')
    expect(root.dataset.ffAccent).toBe('rose')
  })

  it('re-applies on an OS scheme change only while the effective preference is system', async () => {
    const media = stubMatchMedia(false)
    const source = reactive<{ theme: ThemeScheme, accent: AccentId }>({ theme: 'system', accent: 'blue' })

    initThemeController(source)
    const root = document.documentElement
    expect(root.dataset.ffTheme).toBe('light') // system + OS light

    // OS flips to dark → the `system` preference follows it.
    media.set(true)
    media.fire()
    expect(root.dataset.ffTheme).toBe('dark')

    // Pin an explicit light preference; subsequent OS changes must be ignored.
    source.theme = 'light'
    await nextTick()
    expect(root.dataset.ffTheme).toBe('light')
    media.set(true)
    media.fire()
    expect(root.dataset.ffTheme).toBe('light') // explicit light wins over OS dark
  })

  it('overrides only the embed-provided dimension, leaving the other on the ui source', () => {
    stubMatchMedia(false)
    const source = reactive<{ theme: ThemeScheme, accent: AccentId }>({ theme: 'light', accent: 'green' })
    initThemeController(source)
    const root = document.documentElement

    // theme-only override: accent still tracks the ui source.
    setEmbedTheme('dark')
    expect(root.dataset.ffTheme).toBe('dark')
    expect(root.dataset.ffAccent).toBe('green')

    // accent-only override accumulates; the earlier theme override persists.
    setEmbedTheme(undefined, 'rose')
    expect(root.dataset.ffTheme).toBe('dark')
    expect(root.dataset.ffAccent).toBe('rose')
  })
})
