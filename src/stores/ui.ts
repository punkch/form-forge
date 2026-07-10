import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// Pre-rebrand key kept on purpose: existing users' persisted prefs live here.
const STORAGE_KEY = 'odk-builder:ui:v1'
const STORAGE_VERSION = 1

export type PreviewPreset = 'phone' | 'tablet' | 'fill'
export type PanelName = 'palette' | 'properties' | 'preview'

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
  storageHintDismissed: boolean
}

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
  const propSectionsCollapsed = ref<Record<string, boolean>>(
    typeof persisted.propSectionsCollapsed === 'object' && persisted.propSectionsCollapsed !== null
      ? { ...persisted.propSectionsCollapsed }
      : {}
  )
  /** One-time library-footer hint shown while storage is not persistent. */
  const storageHintDismissed = ref(persisted.storageHintDismissed === true)

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

  watch(
    [paletteWidth, propertiesWidth, previewWidth, previewPreset, paletteVisible, propSectionsCollapsed, locale, storageHintDismissed],
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
        storageHintDismissed: storageHintDismissed.value,
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
    storageHintDismissed,
    setPanelWidth,
    resetPanelWidth,
    toggleSection,
    dismissStorageHint,
  }
})
