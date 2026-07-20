import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import {
  DEFAULT_ACCENT,
  DEFAULT_CONTRAST,
  DEFAULT_THEME,
  isAccentId,
  isContrastPref,
  isThemeScheme,
  type AccentId,
  type ContrastPref,
  type ThemeScheme,
} from '@/theme/constants'

// Pre-rebrand key kept on purpose: existing users' persisted prefs live here.
const STORAGE_KEY = 'odk-builder:ui:v1'
const STORAGE_VERSION = 1

export type PreviewPreset = 'phone' | 'tablet' | 'fill'
export type PanelName = 'palette' | 'properties' | 'preview'

export type ExportFormatId = 'xform' | 'xlsform' | 'zip-xform' | 'zip-xlsform'

const EXPORT_FORMAT_IDS: readonly ExportFormatId[] =
  ['xform', 'xlsform', 'zip-xform', 'zip-xlsform']

const isExportFormatId = (v: unknown): v is ExportFormatId =>
  typeof v === 'string' && (EXPORT_FORMAT_IDS as readonly string[]).includes(v)

/** Keep only `{ formId: ExportFormatId }` entries with string keys and a
 * recognised format value. Unknown formats / non-string values dropped. */
const sanitizeExportFormatMap = (raw: unknown): Record<string, ExportFormatId> => {
  if (typeof raw !== 'object' || raw === null) return {}
  const out: Record<string, ExportFormatId> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isExportFormatId(value)) out[key] = value
  }
  return out
}

interface PanelLimits {
  min: number
  /** Fixed pixel max, or a function of the viewport for viewport-relative caps. */
  max: number | ((viewportWidth: number) => number)
  default: number
}

export const PANEL_LIMITS: Record<PanelName, PanelLimits> = {
  palette: { min: 200, max: 340, default: 250 },
  properties: { min: 300, max: 560, default: 360 },
  preview: { min: 360, max: (vw) => Math.round(vw * 0.6), default: 420 },
}

/** Content widths the preview presets render the form at. */
export const PREVIEW_PRESET_WIDTHS: Record<Exclude<PreviewPreset, 'fill'>, number> = {
  phone: 360,
  tablet: 768,
}

const panelMax = (panel: PanelName): number => {
  const max = PANEL_LIMITS[panel].max
  return typeof max === 'function' ? max(window.innerWidth) : max
}

export const clampPanelWidth = (panel: PanelName, px: number): number => {
  const { min } = PANEL_LIMITS[panel]
  return Math.round(Math.min(Math.max(px, min), Math.max(panelMax(panel), min)))
}

interface PersistedUiState {
  version: number
  paletteWidth: number
  propertiesWidth: number
  previewWidth: number
  previewPreset: PreviewPreset
  paletteVisible: boolean
  propSectionsCollapsed: Record<string, boolean>
  locale: string
  theme: ThemeScheme
  accent: AccentId
  contrast: ContrastPref
  storageHintDismissed: boolean
  dismissedCallouts: string[]
  hiddenBundledTemplates: string[]
  lastExportFormat: Record<string, ExportFormatId>
}

/** The persisted UI preferences without the storage-format `version` — the
 * shape carried in a whole-workspace backup's `preferences.json`. */
export type UiPreferences = Omit<PersistedUiState, 'version'>

const PRESETS: readonly PreviewPreset[] = ['phone', 'tablet', 'fill']

const loadPersisted = (): Partial<PersistedUiState> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const state = parsed as Partial<PersistedUiState>
    if (state.version !== STORAGE_VERSION) return {}
    return state
  } catch {
    // Corrupt JSON or storage unavailable (private mode) — fall back to defaults.
    return {}
  }
}

const numberOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/**
 * Persisted, device-level UI preferences (panel widths, preview preset, …).
 * Lives in localStorage — not Dexie — so widths are available synchronously
 * at first paint, and separate from the editor store whose reset() runs on
 * every form load.
 */
export const useUiStore = defineStore('ui', () => {
  const persisted = loadPersisted()

  const paletteWidth = ref(clampPanelWidth('palette', numberOr(persisted.paletteWidth, PANEL_LIMITS.palette.default)))
  const propertiesWidth = ref(clampPanelWidth('properties', numberOr(persisted.propertiesWidth, PANEL_LIMITS.properties.default)))
  const previewWidth = ref(clampPanelWidth('preview', numberOr(persisted.previewWidth, PANEL_LIMITS.preview.default)))
  const previewPreset = ref<PreviewPreset>(
    PRESETS.includes(persisted.previewPreset as PreviewPreset) ? persisted.previewPreset as PreviewPreset : 'fill'
  )
  const paletteVisible = ref(typeof persisted.paletteVisible === 'boolean' ? persisted.paletteVisible : true)
  /** BCP-47 tag of the UI language; applied via i18n's setLocale on startup. */
  const locale = ref(typeof persisted.locale === 'string' && persisted.locale !== '' ? persisted.locale : 'en')
  /**
   * True when a locale preference was already persisted (as opposed to
   * defaulting to 'en' because none was ever stored). Read once at boot by
   * main.ts to decide whether first-run locale auto-detection should run —
   * kept out of the persisted-watch list below since it's a boot-time fact,
   * not a live preference.
   */
  const localeWasStored = typeof persisted.locale === 'string' && persisted.locale !== ''
  /** Colour-scheme preference; `system` follows the OS. Applied by the theme controller. */
  const theme = ref<ThemeScheme>(isThemeScheme(persisted.theme) ? persisted.theme : DEFAULT_THEME)
  /** Accent-colour preset id; recolours chrome + preview alike. */
  const accent = ref<AccentId>(isAccentId(persisted.accent) ? persisted.accent : DEFAULT_ACCENT)
  /** Contrast preference, orthogonal to theme; `system` follows the OS. Applied by the theme controller. */
  const contrast = ref<ContrastPref>(isContrastPref(persisted.contrast) ? persisted.contrast : DEFAULT_CONTRAST)
  const propSectionsCollapsed = ref<Record<string, boolean>>(
    typeof persisted.propSectionsCollapsed === 'object' && persisted.propSectionsCollapsed !== null
      ? { ...persisted.propSectionsCollapsed }
      : {}
  )
  /** One-time library-footer hint shown while storage is not persistent. */
  const storageHintDismissed = ref(persisted.storageHintDismissed === true)
  /** Ids of first-use guide callouts the user dismissed (never re-shown). */
  const dismissedCallouts = ref<string[]>(
    Array.isArray(persisted.dismissedCallouts)
      ? persisted.dismissedCallouts.filter((id): id is string => typeof id === 'string')
      : []
  )
  /** Ids of bundled starter templates the user hid from the "New form" gallery. */
  const hiddenBundledTemplates = ref<string[]>(
    Array.isArray(persisted.hiddenBundledTemplates)
      ? persisted.hiddenBundledTemplates.filter((id): id is string => typeof id === 'string')
      : []
  )
  /** Last export format chosen per form (keyed by Dexie recordId). */
  const lastExportFormat = ref<Record<string, ExportFormatId>>(
    sanitizeExportFormatMap(persisted.lastExportFormat)
  )

  const widthRef = (panel: PanelName) =>
    panel === 'palette' ? paletteWidth : panel === 'properties' ? propertiesWidth : previewWidth

  const setPanelWidth = (panel: PanelName, px: number): void => {
    widthRef(panel).value = clampPanelWidth(panel, px)
  }

  const resetPanelWidth = (panel: PanelName): void => {
    widthRef(panel).value = PANEL_LIMITS[panel].default
  }

  const toggleSection = (key: string): void => {
    propSectionsCollapsed.value = {
      ...propSectionsCollapsed.value,
      [key]: !(propSectionsCollapsed.value[key] ?? false),
    }
  }

  const dismissStorageHint = (): void => {
    storageHintDismissed.value = true
  }

  const dismissCallout = (id: string): void => {
    if (!dismissedCallouts.value.includes(id)) {
      dismissedCallouts.value = [...dismissedCallouts.value, id]
    }
  }

  const isCalloutDismissed = (id: string): boolean => dismissedCallouts.value.includes(id)

  const hideBundledTemplate = (id: string): void => {
    if (!hiddenBundledTemplates.value.includes(id)) {
      hiddenBundledTemplates.value = [...hiddenBundledTemplates.value, id]
    }
  }

  const unhideBundledTemplate = (id: string): void => {
    hiddenBundledTemplates.value = hiddenBundledTemplates.value.filter((existing) => existing !== id)
  }

  const resetHiddenBundledTemplates = (): void => {
    hiddenBundledTemplates.value = []
  }

  const isBundledTemplateHidden = (id: string): boolean => hiddenBundledTemplates.value.includes(id)

  const setLastExportFormat = (formId: string, id: ExportFormatId): void => {
    if (lastExportFormat.value[formId] === id) return
    lastExportFormat.value = { ...lastExportFormat.value, [formId]: id }
  }

  const getLastExportFormat = (formId: string): ExportFormatId | null =>
    lastExportFormat.value[formId] ?? null

  const forgetExportFormat = (formId: string): void => {
    if (!(formId in lastExportFormat.value)) return
    const next = { ...lastExportFormat.value }
    delete next[formId]
    lastExportFormat.value = next
  }

  /** Snapshot of the persisted preferences for a whole-workspace backup. */
  const exportPreferences = (): UiPreferences => ({
    paletteWidth: paletteWidth.value,
    propertiesWidth: propertiesWidth.value,
    previewWidth: previewWidth.value,
    previewPreset: previewPreset.value,
    paletteVisible: paletteVisible.value,
    propSectionsCollapsed: { ...propSectionsCollapsed.value },
    locale: locale.value,
    theme: theme.value,
    accent: accent.value,
    contrast: contrast.value,
    storageHintDismissed: storageHintDismissed.value,
    dismissedCallouts: [...dismissedCallouts.value],
    hiddenBundledTemplates: [...hiddenBundledTemplates.value],
    lastExportFormat: { ...lastExportFormat.value },
  })

  /**
   * Apply preferences restored from a backup. Each field is validated with the
   * same guards as the initial load; unknown/invalid fields are ignored. Setting
   * the refs persists them (the watcher) and applies theme/accent live (the
   * theme controller watches them). The `locale` ref is updated here, but
   * switching the app language additionally needs `setLocale(locale)` — the
   * caller does that, keeping this store free of i18n runtime deps.
   */
  const applyPreferences = (raw: unknown): void => {
    if (typeof raw !== 'object' || raw === null) return
    const p = raw as Partial<PersistedUiState>
    if (typeof p.paletteWidth === 'number' && Number.isFinite(p.paletteWidth)) {
      paletteWidth.value = clampPanelWidth('palette', p.paletteWidth)
    }
    if (typeof p.propertiesWidth === 'number' && Number.isFinite(p.propertiesWidth)) {
      propertiesWidth.value = clampPanelWidth('properties', p.propertiesWidth)
    }
    if (typeof p.previewWidth === 'number' && Number.isFinite(p.previewWidth)) {
      previewWidth.value = clampPanelWidth('preview', p.previewWidth)
    }
    if (PRESETS.includes(p.previewPreset as PreviewPreset)) previewPreset.value = p.previewPreset as PreviewPreset
    if (typeof p.paletteVisible === 'boolean') paletteVisible.value = p.paletteVisible
    if (typeof p.propSectionsCollapsed === 'object' && p.propSectionsCollapsed !== null) {
      propSectionsCollapsed.value = { ...p.propSectionsCollapsed }
    }
    if (typeof p.locale === 'string' && p.locale !== '') locale.value = p.locale
    if (isThemeScheme(p.theme)) theme.value = p.theme
    if (isAccentId(p.accent)) accent.value = p.accent
    if (isContrastPref(p.contrast)) contrast.value = p.contrast
    if (typeof p.storageHintDismissed === 'boolean') storageHintDismissed.value = p.storageHintDismissed
    if (Array.isArray(p.dismissedCallouts)) {
      dismissedCallouts.value = p.dismissedCallouts.filter((id): id is string => typeof id === 'string')
    }
    if (Array.isArray(p.hiddenBundledTemplates)) {
      hiddenBundledTemplates.value = p.hiddenBundledTemplates.filter((id): id is string => typeof id === 'string')
    }
    if (typeof p.lastExportFormat === 'object' && p.lastExportFormat !== null) {
      lastExportFormat.value = sanitizeExportFormatMap(p.lastExportFormat)
    }
  }

  watch(
    [paletteWidth, propertiesWidth, previewWidth, previewPreset, paletteVisible, propSectionsCollapsed, locale, theme, accent, contrast, storageHintDismissed, dismissedCallouts, hiddenBundledTemplates, lastExportFormat],
    () => {
      const state: PersistedUiState = {
        version: STORAGE_VERSION,
        paletteWidth: paletteWidth.value,
        propertiesWidth: propertiesWidth.value,
        previewWidth: previewWidth.value,
        previewPreset: previewPreset.value,
        paletteVisible: paletteVisible.value,
        propSectionsCollapsed: propSectionsCollapsed.value,
        locale: locale.value,
        theme: theme.value,
        accent: accent.value,
        contrast: contrast.value,
        storageHintDismissed: storageHintDismissed.value,
        dismissedCallouts: dismissedCallouts.value,
        hiddenBundledTemplates: hiddenBundledTemplates.value,
        lastExportFormat: lastExportFormat.value,
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
        // Storage full or unavailable — preferences simply don't persist.
      }
    },
    { deep: true }
  )

  return {
    paletteWidth,
    propertiesWidth,
    previewWidth,
    previewPreset,
    paletteVisible,
    propSectionsCollapsed,
    locale,
    localeWasStored,
    theme,
    accent,
    contrast,
    storageHintDismissed,
    dismissedCallouts,
    hiddenBundledTemplates,
    lastExportFormat,
    setPanelWidth,
    resetPanelWidth,
    toggleSection,
    dismissStorageHint,
    dismissCallout,
    isCalloutDismissed,
    hideBundledTemplate,
    unhideBundledTemplate,
    resetHiddenBundledTemplates,
    isBundledTemplateHidden,
    setLastExportFormat,
    getLastExportFormat,
    forgetExportFormat,
    exportPreferences,
    applyPreferences,
  }
})
