// Theme apply-layer tests — happy-dom (real document/head). Covers applyTheme's
// attribute + browser-chrome-meta stamping and the embed-override precedence of
// the module controller. matchMedia is stubbed so scheme/contrast resolution is
// deterministic across happy-dom/jsdom.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import {
  applyTheme,
  initThemeController,
  setEmbedTheme,
  type AccentId,
  type ContrastPref,
  type ThemeScheme,
} from '@/theme'

const metaContent = (name: string): string | null =>
  document.head.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? null

/**
 * Deterministic prefers-color-scheme + prefers-contrast stubs with capturable
 * listeners, so a test can flip either OS signal independently (`setDark`/
 * `setContrast`) and invoke its registered change handler (`fireDark`/
 * `fireContrast`). Two distinct mock MediaQueryList objects are returned based
 * on the query string `window.matchMedia` is called with — mirroring how a
 * real browser hands back a different MediaQueryList per query — since the
 * controller registers independent listeners for each media feature.
 */
const stubMatchMedia = (
  initial: { dark?: boolean, contrast?: boolean } = {}
): { setDark: (v: boolean) => void, fireDark: () => void, setContrast: (v: boolean) => void, fireContrast: () => void } => {
  let darkListener: (() => void) | null = null
  let contrastListener: (() => void) | null = null
  const darkMql = {
    matches: initial.dark ?? false,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (_type: string, cb: () => void) => { darkListener = cb },
    removeEventListener: () => { darkListener = null },
    addListener: (cb: () => void) => { darkListener = cb },
    removeListener: () => { darkListener = null },
    dispatchEvent: () => false,
  }
  const contrastMql = {
    matches: initial.contrast ?? false,
    media: '(prefers-contrast: more)',
    onchange: null,
    addEventListener: (_type: string, cb: () => void) => { contrastListener = cb },
    removeEventListener: () => { contrastListener = null },
    addListener: (cb: () => void) => { contrastListener = cb },
    removeListener: () => { contrastListener = null },
    dispatchEvent: () => false,
  }
  vi.stubGlobal('matchMedia', (query: string) => (query.includes('prefers-contrast') ? contrastMql : darkMql))
  return {
    setDark: (v: boolean) => { darkMql.matches = v },
    fireDark: () => darkListener?.(),
    setContrast: (v: boolean) => { contrastMql.matches = v },
    fireContrast: () => contrastListener?.(),
  }
}

beforeEach(() => {
  for (const m of document.head.querySelectorAll('meta[name="color-scheme"], meta[name="theme-color"]')) {
    m.remove()
  }
  delete document.documentElement.dataset.ffTheme
  delete document.documentElement.dataset.ffAccent
  delete document.documentElement.dataset.ffContrast
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('applyTheme', () => {
  it('stamps the html attributes and creates the chrome metas when absent (light → accent hex)', () => {
    expect(metaContent('color-scheme')).toBeNull()

    applyTheme('light', 'green', 'normal')

    const root = document.documentElement
    expect(root.dataset.ffTheme).toBe('light')
    expect(root.dataset.ffAccent).toBe('green')
    expect(metaContent('color-scheme')).toBe('light')
    // green's hex500 is the light-mode theme-color.
    expect(metaContent('theme-color')).toBe('#0f7c39')
  })

  it('uses the dark chrome surface for theme-color in dark', () => {
    applyTheme('dark', 'blue', 'normal')

    const root = document.documentElement
    expect(root.dataset.ffTheme).toBe('dark')
    expect(root.dataset.ffAccent).toBe('blue')
    expect(metaContent('color-scheme')).toBe('dark')
    expect(metaContent('theme-color')).toBe('#0f172a')
  })

  it('renders the blue default accent hex in light', () => {
    applyTheme('light', 'blue', 'normal')
    expect(metaContent('theme-color')).toBe('#3e9fcc')
  })

  it('updates an existing meta rather than duplicating it', () => {
    const pre = document.createElement('meta')
    pre.setAttribute('name', 'color-scheme')
    pre.setAttribute('content', 'light')
    document.head.appendChild(pre)

    applyTheme('dark', 'purple', 'normal')

    const metas = document.head.querySelectorAll('meta[name="color-scheme"]')
    expect(metas.length).toBe(1)
    expect(metas[0].getAttribute('content')).toBe('dark')
  })

  it('stamps data-ff-contrast="high" when passed high', () => {
    applyTheme('light', 'blue', 'high')
    expect(document.documentElement.dataset.ffContrast).toBe('high')
  })

  it('removes data-ff-contrast when passed normal (even if previously stamped high)', () => {
    applyTheme('light', 'blue', 'high')
    expect(document.documentElement.dataset.ffContrast).toBe('high')

    applyTheme('light', 'blue', 'normal')
    expect(document.documentElement.dataset.ffContrast).toBeUndefined()
    expect(document.documentElement.hasAttribute('data-ff-contrast')).toBe(false)
  })
})

describe('initThemeController + setEmbedTheme precedence', () => {
  it('applies the ui source on init, then lets an embed override win', async () => {
    stubMatchMedia()
    const source = reactive<{ theme: ThemeScheme, accent: AccentId, contrast: ContrastPref }>({
      theme: 'light', accent: 'green', contrast: 'normal',
    })

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
    const media = stubMatchMedia()
    const source = reactive<{ theme: ThemeScheme, accent: AccentId, contrast: ContrastPref }>({
      theme: 'system', accent: 'blue', contrast: 'normal',
    })

    initThemeController(source)
    const root = document.documentElement
    expect(root.dataset.ffTheme).toBe('light') // system + OS light

    // OS flips to dark → the `system` preference follows it.
    media.setDark(true)
    media.fireDark()
    expect(root.dataset.ffTheme).toBe('dark')

    // Pin an explicit light preference; subsequent OS changes must be ignored.
    source.theme = 'light'
    await nextTick()
    expect(root.dataset.ffTheme).toBe('light')
    media.setDark(true)
    media.fireDark()
    expect(root.dataset.ffTheme).toBe('light') // explicit light wins over OS dark
  })

  it('overrides only the embed-provided dimension, leaving the other on the ui source', () => {
    stubMatchMedia()
    const source = reactive<{ theme: ThemeScheme, accent: AccentId, contrast: ContrastPref }>({
      theme: 'light', accent: 'green', contrast: 'normal',
    })
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

  it('re-applies on an OS contrast change only while the effective preference is system', async () => {
    const media = stubMatchMedia()
    const source = reactive<{ theme: ThemeScheme, accent: AccentId, contrast: ContrastPref }>({
      theme: 'light', accent: 'blue', contrast: 'system',
    })

    initThemeController(source)
    const root = document.documentElement
    expect(root.dataset.ffContrast).toBeUndefined() // system + OS no-preference

    // OS signals prefers-contrast: more → the `system` preference follows it.
    media.setContrast(true)
    media.fireContrast()
    expect(root.dataset.ffContrast).toBe('high')

    // Pin an explicit normal preference; subsequent OS changes must be ignored.
    source.contrast = 'normal'
    await nextTick()
    expect(root.dataset.ffContrast).toBeUndefined()
    media.setContrast(false)
    media.fireContrast()
    expect(root.dataset.ffContrast).toBeUndefined() // explicit normal wins over OS

    // ... and flipping OS `more` back on must not resurrect it either.
    media.setContrast(true)
    media.fireContrast()
    expect(root.dataset.ffContrast).toBeUndefined()
  })

  it("setEmbedTheme's third argument overrides the persisted contrast, and an omitted third argument leaves a prior override in place", () => {
    stubMatchMedia()
    const source = reactive<{ theme: ThemeScheme, accent: AccentId, contrast: ContrastPref }>({
      theme: 'light', accent: 'blue', contrast: 'normal',
    })
    initThemeController(source)
    const root = document.documentElement
    expect(root.dataset.ffContrast).toBeUndefined()

    setEmbedTheme(undefined, undefined, 'high')
    expect(root.dataset.ffContrast).toBe('high')

    // A later call omitting contrast must not drop the earlier override.
    setEmbedTheme('dark')
    expect(root.dataset.ffTheme).toBe('dark')
    expect(root.dataset.ffContrast).toBe('high')

    // The ui source changing contrast must not dislodge the still-active override.
    source.contrast = 'high' // no-op value change, but prove override still wins even if toggled
    source.contrast = 'normal'
    expect(root.dataset.ffContrast).toBe('high')
  })
})
