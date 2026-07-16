/**
 * Theme apply layer — the runtime side of theming.
 *
 * Owns the `<html data-ff-theme data-ff-accent data-ff-contrast>` attributes
 * (which the committed generated + hand-authored CSS key on) and the dynamic
 * `<meta name="color-scheme">` / `<meta name="theme-color">`. A single
 * module-level controller resolves the effective scheme/accent/contrast from
 * the ui-store preference (or an embed-host override), tracks the OS
 * `prefers-color-scheme` and `prefers-contrast` when the corresponding
 * preference is `system`, and re-applies on any change.
 *
 * The no-FOUC inline script in index.html stamps the SAME attributes before the
 * bundle parses; this controller then takes over reactively. Agreement between
 * the two is pinned by tests/unit/theme-inline-script.spec.ts.
 */
import { watch } from 'vue'

import {
  ACCENTS,
  DEFAULT_ACCENT,
  DEFAULT_CONTRAST,
  DEFAULT_THEME,
  resolveContrast,
  resolveScheme,
  type AccentId,
  type ContrastPref,
  type ResolvedContrast,
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
  contrast: ContrastPref
}

const state: {
  ui: ThemeSource | null
  override: { theme?: ThemeScheme, accent?: AccentId, contrast?: ContrastPref }
  media: MediaQueryList | null
  onSchemeChange: (() => void) | null
  contrastMedia: MediaQueryList | null
  onContrastChange: (() => void) | null
  stopWatch: (() => void) | null
} = {
  ui: null,
  override: {},
  media: null,
  onSchemeChange: null,
  contrastMedia: null,
  onContrastChange: null,
  stopWatch: null,
}

/** Whether the OS currently prefers dark; false when unknown (no matchMedia). */
const systemPrefersDark = (): boolean => state.media?.matches ?? false
/** Whether the OS currently signals prefers-contrast: more; false when unknown. */
const systemPrefersMoreContrast = (): boolean => state.contrastMedia?.matches ?? false

const effectiveTheme = (): ThemeScheme => state.override.theme ?? state.ui?.theme ?? DEFAULT_THEME
const effectiveAccent = (): AccentId => state.override.accent ?? state.ui?.accent ?? DEFAULT_ACCENT
const effectiveContrast = (): ContrastPref => state.override.contrast ?? state.ui?.contrast ?? DEFAULT_CONTRAST

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
 * Stamp the resolved scheme + accent + contrast onto <html> and sync the
 * browser-chrome metas. `resolved`/`contrast` are always concrete, never
 * `system`. `data-ff-contrast` is only present when `contrast === 'high'` —
 * `normal` leaves the attribute absent, matching the generated/hand-authored
 * CSS which only ever key on `[data-ff-contrast="high"]`.
 */
export const applyTheme = (resolved: ResolvedScheme, accent: AccentId, contrast: ResolvedContrast): void => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.ffTheme = resolved
  root.dataset.ffAccent = accent
  if (contrast === 'high') {
    root.dataset.ffContrast = 'high'
  } else {
    delete root.dataset.ffContrast
  }
  setMeta('color-scheme', resolved)
  setMeta('theme-color', resolved === 'dark' ? DARK_THEME_COLOR : ACCENT_HEX[accent])
}

const apply = (): void => {
  applyTheme(
    resolveScheme(effectiveTheme(), systemPrefersDark()),
    effectiveAccent(),
    resolveContrast(effectiveContrast(), systemPrefersMoreContrast())
  )
}

/** Stop the store watcher and detach the OS media listeners from a prior init. */
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
  if (state.contrastMedia !== null && state.onContrastChange !== null) {
    if (typeof state.contrastMedia.removeEventListener === 'function') {
      state.contrastMedia.removeEventListener('change', state.onContrastChange)
    } else {
      ;(state.contrastMedia as MediaQueryList & { removeListener?: (cb: () => void) => void }).removeListener?.(state.onContrastChange)
    }
  }
  state.onContrastChange = null
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

    state.contrastMedia = window.matchMedia('(prefers-contrast: more)')
    const onContrastChange = (): void => {
      // Only the OS matters while the *effective* preference is `system`.
      if (effectiveContrast() === 'system') apply()
    }
    state.onContrastChange = onContrastChange
    if (typeof state.contrastMedia.addEventListener === 'function') {
      state.contrastMedia.addEventListener('change', onContrastChange)
    } else {
      ;(state.contrastMedia as MediaQueryList & { addListener?: (cb: () => void) => void }).addListener?.(onContrastChange)
    }
  }
  state.stopWatch = watch(() => [ui.theme, ui.accent, ui.contrast], apply)
  apply()
}

/**
 * Apply an embed host's theme/accent/contrast, which take precedence over the
 * persisted preference (mirroring how embed `locale` overrides the ui-store
 * locale). Overrides ACCUMULATE — each provided field replaces its dimension
 * and persists until the host sends a new value for it; an omitted field keeps
 * whatever was set before (or, if never set, the user/device preference).
 * `system` is honoured — the embedded builder then follows the host viewer's
 * OS for that dimension.
 */
export const setEmbedTheme = (override: { theme?: ThemeScheme, accent?: AccentId, contrast?: ContrastPref }): void => {
  if (override.theme !== undefined) state.override.theme = override.theme
  if (override.accent !== undefined) state.override.accent = override.accent
  if (override.contrast !== undefined) state.override.contrast = override.contrast
  apply()
}
