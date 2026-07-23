/**
 * Theme constants — the single source of truth for theme/accent identifiers,
 * shared by the ui store (validation), the embed protocol (coercion), the
 * Appearance UI (options), the no-FOUC inline script, and the CSS generator.
 *
 * PURE module: no Vue, no DOM, no i18n imports. Safe to import from anywhere,
 * including Node scripts (scripts/generate-theme-css.mjs) and the store.
 */

/** User-selectable colour scheme preference. `system` follows the OS. */
export type ThemeScheme = 'light' | 'dark' | 'system'
/** A concrete, applied scheme — never `system`. */
export type ResolvedScheme = 'light' | 'dark'

export const THEME_SCHEMES: readonly ThemeScheme[] = ['light', 'dark', 'system']
export const DEFAULT_THEME: ThemeScheme = 'system'

export type AccentId = 'blue' | 'purple' | 'green' | 'teal' | 'amber' | 'rose'

export interface AccentDef {
  id: AccentId
  /**
   * The swatch colour shown in the picker — the effective primary-500 the
   * accent renders (green is the AA-nudged value, matching the generated CSS,
   * not the raw #16A34A anchor). Kept in sync with scripts/generate-theme-css.mjs
   * by tests/unit/theme-generated.spec.ts. UI labels come from the i18n catalog
   * key `appSettings.appearance.accent.<id>` (built at the call site).
   */
  hex500: string
}

/**
 * `blue` is the base ODK primary scale and emits NO accent override; the
 * other ids each map to a `:root[data-ff-accent="…"]` block in the generated
 * theme-accents.css (so `purple`, the DEFAULT_ACCENT, applies its own block).
 * Order here is the swatch order in Settings.
 */
export const ACCENTS: readonly AccentDef[] = [
  { id: 'blue', hex500: '#3e9fcc' },
  { id: 'purple', hex500: '#6366f1' },
  { id: 'green', hex500: '#0f7c39' },
  { id: 'teal', hex500: '#0d9488' },
  { id: 'amber', hex500: '#f59e0b' },
  { id: 'rose', hex500: '#e11d48' },
]

export const ACCENT_IDS: readonly AccentId[] = ACCENTS.map((a) => a.id)
export const DEFAULT_ACCENT: AccentId = 'purple'

export const isThemeScheme = (value: unknown): value is ThemeScheme =>
  typeof value === 'string' && (THEME_SCHEMES as readonly string[]).includes(value)

export const isAccentId = (value: unknown): value is AccentId =>
  typeof value === 'string' && (ACCENT_IDS as readonly string[]).includes(value)

/** Resolve a preference to a concrete scheme, given the OS dark-mode state. */
export const resolveScheme = (theme: ThemeScheme, systemPrefersDark: boolean): ResolvedScheme => {
  if (theme === 'system') return systemPrefersDark ? 'dark' : 'light'
  return theme
}

/**
 * User-selectable contrast preference — orthogonal to `theme`. `system` follows
 * the OS `prefers-contrast: more` signal. `prefers-contrast: less` and "no
 * preference" both resolve the same as a `system` user with no OS signal:
 * `normal` — there is no distinct "less" state (see resolveContrast below).
 */
export type ContrastPref = 'normal' | 'high' | 'system'
/** A concrete, applied contrast level — never `system`. */
export type ResolvedContrast = 'normal' | 'high'

export const CONTRAST_PREFS: readonly ContrastPref[] = ['normal', 'high', 'system']
export const DEFAULT_CONTRAST: ContrastPref = 'system'

export const isContrastPref = (value: unknown): value is ContrastPref =>
  typeof value === 'string' && (CONTRAST_PREFS as readonly string[]).includes(value)

/**
 * Resolve a preference to a concrete contrast level, given whether the OS
 * currently signals `prefers-contrast: more`. The caller only ever feeds the
 * boolean for `more`, never for `less` — so `less` and no-preference both
 * resolve to `normal` here, satisfying "treat `less` as `normal`" without a
 * separate branch.
 */
export const resolveContrast = (pref: ContrastPref, systemPrefersMore: boolean): ResolvedContrast => {
  if (pref === 'system') return systemPrefersMore ? 'high' : 'normal'
  return pref
}

/**
 * The single source of truth for the high-contrast surface colours: both the
 * hand-authored src/styles/builder-contrast.css and the generated
 * generateAccentContrastCss()'s WCAG ratio math agree with these values —
 * tests/unit/theme-contrast-ratio.spec.ts cross-checks the CSS literal against
 * this constant so the two can never silently drift apart.
 */
export const HIGH_CONTRAST_SURFACES = {
  light: { bg: '#ffffff', text: '#000000' },
  dark: { bg: '#000000', text: '#ffffff' },
} as const

/**
 * The single source of truth for the NORMAL-mode (no `data-ff-contrast="high"`)
 * worst-case surface backgrounds an accent's applied primary colour can land
 * on — the app's lightest "muted/base" surface tier in each scheme, per
 * `odk-tokens.css`/`builder-dark.css`. Used by the AA accent clamp
 * (`generateAccentAaCss()` in scripts/theme-css-lib.mjs) the same way
 * `HIGH_CONTRAST_SURFACES` feeds the AAA clamp; kept here (not duplicated in
 * the .mjs) for the same reason — a single import, no drift.
 */
export const NORMAL_AA_SURFACES = {
  light: '#f8fafc',
  dark: '#1e293b',
} as const
