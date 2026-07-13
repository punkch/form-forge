/**
 * Theme apply layer — the runtime side of theming.
 *
 * Owns the `<html data-ff-theme data-ff-accent>` attributes (which the committed
 * generated CSS keys on) and the dynamic `<meta name="color-scheme">` /
 * `<meta name="theme-color">`. A single module-level controller resolves the
 * effective scheme from the ui-store preference (or an embed-host override),
 * tracks the OS `prefers-color-scheme` when the preference is `system`, and
 * re-applies on any change.
 *
 * The no-FOUC inline script in index.html stamps the SAME attributes before the
 * bundle parses; this controller then takes over reactively. Agreement between
 * the two is pinned by tests/unit/theme-inline-script.spec.ts.
 */
import { watch } from 'vue'

import {
  ACCENTS,
  DEFAULT_ACCENT,
  DEFAULT_THEME,
  resolveScheme,
  type AccentId,
  type ResolvedScheme,
  type ThemeScheme,
} from './constants'

export * from './constants'

const ACCENT_HEX = Object.fromEntries(ACCENTS.map((a) => [a.id, a.hex500])) as Record<AccentId, string>
/** Dark chrome surface (slate-900) — the browser-UI theme-color while dark. */
const DARK_THEME_COLOR = '#0f172a'

/** Minimal reactive shape this controller reads from the ui store. */
interface ThemeSource {
  theme: ThemeScheme
  accent: AccentId
}

const state: {
  ui: ThemeSource | null
  override: { theme?: ThemeScheme, accent?: AccentId }
  media: MediaQueryList | null
  onSchemeChange: (() => void) | null
  stopWatch: (() => void) | null
} = { ui: null, override: {}, media: null, onSchemeChange: null, stopWatch: null }

/** Whether the OS currently prefers dark; false when unknown (no matchMedia). */
const systemPrefersDark = (): boolean => state.media?.matches ?? false

const effectiveTheme = (): ThemeScheme => state.override.theme ?? state.ui?.theme ?? DEFAULT_THEME
const effectiveAccent = (): AccentId => state.override.accent ?? state.ui?.accent ?? DEFAULT_ACCENT

const setMeta = (name: string, content: string): void => {
  if (typeof document === 'undefined') return
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (el === null) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * Stamp the resolved scheme + accent onto <html> and sync the browser-chrome
 * metas. `resolved` is always concrete (`light`/`dark`), never `system`.
 */
export const applyTheme = (resolved: ResolvedScheme, accent: AccentId): void => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.ffTheme = resolved
  root.dataset.ffAccent = accent
  setMeta('color-scheme', resolved)
  setMeta('theme-color', resolved === 'dark' ? DARK_THEME_COLOR : ACCENT_HEX[accent])
}

const apply = (): void => {
  applyTheme(resolveScheme(effectiveTheme(), systemPrefersDark()), effectiveAccent())
}

/** Stop the store watcher and detach the OS-scheme listener from a prior init. */
const teardown = (): void => {
  if (state.stopWatch !== null) {
    state.stopWatch()
    state.stopWatch = null
  }
  if (state.media !== null && state.onSchemeChange !== null) {
    if (typeof state.media.removeEventListener === 'function') {
      state.media.removeEventListener('change', state.onSchemeChange)
    } else {
      ;(state.media as MediaQueryList & { removeListener?: (cb: () => void) => void }).removeListener?.(state.onSchemeChange)
    }
  }
  state.onSchemeChange = null
}

/**
 * Wire the controller to the ui store, apply once (pre-mount), and start
 * watching the preference + the OS scheme. Called once from main.ts, next to
 * setLocale. `ui` must be the reactive ui store (its `theme`/`accent` are read
 * reactively). Idempotent: a re-init tears down the previous wiring first, so
 * repeated calls (chiefly in tests) never accumulate listeners or watchers.
 */
export const initThemeController = (ui: ThemeSource): void => {
  teardown()
  state.ui = ui
  state.override = {}
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    state.media = window.matchMedia('(prefers-color-scheme: dark)')
    const onSchemeChange = (): void => {
      // Only the OS matters while the *effective* preference is `system`.
      if (effectiveTheme() === 'system') apply()
    }
    state.onSchemeChange = onSchemeChange
    if (typeof state.media.addEventListener === 'function') {
      state.media.addEventListener('change', onSchemeChange)
    } else {
      ;(state.media as MediaQueryList & { addListener?: (cb: () => void) => void }).addListener?.(onSchemeChange)
    }
  }
  state.stopWatch = watch(() => [ui.theme, ui.accent], apply)
  apply()
}

/**
 * Apply an embed host's theme/accent, which take precedence over the persisted
 * preference (mirroring how embed `locale` overrides the ui-store locale).
 * Overrides ACCUMULATE — each provided field replaces its dimension and persists
 * until the host sends a new value for it; an omitted field keeps whatever was
 * set before (or, if never set, the user/device preference). `system` is
 * honoured — the embedded builder then follows the host viewer's OS.
 */
export const setEmbedTheme = (theme?: ThemeScheme, accent?: AccentId): void => {
  if (theme !== undefined) state.override.theme = theme
  if (accent !== undefined) state.override.accent = accent
  apply()
}
