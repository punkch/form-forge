// @vitest-environment happy-dom
// happy-dom (not the unit project's node env) so the store has localStorage to
// persist into and a window for its viewport-relative panel clamps.
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useUiStore } from './ui'

const STORAGE_KEY = 'odk-builder:ui:v1'

describe('ui store locale persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('persists the locale to localStorage when it changes', async () => {
    const ui = useUiStore()
    ui.locale = 'fr'
    await nextTick()

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect((JSON.parse(raw as string) as { locale: string }).locale).toBe('fr')
  })

  it('restores a persisted locale in a fresh store', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, locale: 'es' }))
    setActivePinia(createPinia())

    const ui = useUiStore()
    expect(ui.locale).toBe('es')
    expect(ui.localeWasStored).toBe(true)
  })

  it("defaults to 'en' when storage is missing", () => {
    const ui = useUiStore()
    expect(ui.locale).toBe('en')
    expect(ui.localeWasStored).toBe(false)
  })

  it("defaults to 'en' when the persisted locale is empty", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, locale: '' }))
    setActivePinia(createPinia())

    const ui = useUiStore()
    expect(ui.locale).toBe('en')
    expect(ui.localeWasStored).toBe(false)
  })

  it('treats a version-mismatched persisted blob as never-stored', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, locale: 'fr' }))
    setActivePinia(createPinia())

    const ui = useUiStore()
    expect(ui.locale).toBe('en')
    expect(ui.localeWasStored).toBe(false)
  })
})

describe('ui store theme + accent persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('persists the theme and accent to localStorage when they change', async () => {
    const ui = useUiStore()
    ui.theme = 'dark'
    ui.accent = 'green'
    await nextTick()

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string) as { theme: string, accent: string }
    expect(parsed.theme).toBe('dark')
    expect(parsed.accent).toBe('green')
  })

  it('restores a persisted theme and accent in a fresh store', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, theme: 'light', accent: 'rose' }))
    setActivePinia(createPinia())

    const ui = useUiStore()
    expect(ui.theme).toBe('light')
    expect(ui.accent).toBe('rose')
  })

  it("defaults to 'system' / 'purple' when storage is missing", () => {
    const ui = useUiStore()
    expect(ui.theme).toBe('system')
    expect(ui.accent).toBe('purple')
  })

  it('falls back to defaults when the persisted theme/accent are invalid', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, theme: 'auto', accent: 'orange' }))
    setActivePinia(createPinia())

    const ui = useUiStore()
    expect(ui.theme).toBe('system')
    expect(ui.accent).toBe('purple')
  })

  it('discards a persisted theme/accent on a version mismatch', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, theme: 'dark', accent: 'teal' }))
    setActivePinia(createPinia())

    const ui = useUiStore()
    expect(ui.theme).toBe('system')
    expect(ui.accent).toBe('purple')
  })
})

describe('ui store contrast persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('persists the contrast preference to localStorage when it changes', async () => {
    const ui = useUiStore()
    ui.contrast = 'high'
    await nextTick()

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect((JSON.parse(raw as string) as { contrast: string }).contrast).toBe('high')
  })

  it('restores a persisted contrast preference in a fresh store', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, contrast: 'high' }))
    setActivePinia(createPinia())

    expect(useUiStore().contrast).toBe('high')
  })

  it("defaults to 'system' when storage is missing", () => {
    expect(useUiStore().contrast).toBe('system')
  })

  it('falls back to system when the persisted contrast is invalid', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, contrast: 'extreme' }))
    setActivePinia(createPinia())

    expect(useUiStore().contrast).toBe('system')
  })

  it('discards a persisted contrast on a version mismatch', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, contrast: 'high' }))
    setActivePinia(createPinia())

    expect(useUiStore().contrast).toBe('system')
  })

  it('leaves the default contrast in place when restoring an old-format preferences.json lacking the key', () => {
    // Proves the "no format-version bump" claim in practice: a preferences.json
    // from before this feature shipped has no `contrast` key at all, and a
    // fresh store (still at the default) restores it cleanly with no error.
    const ui = useUiStore()
    expect(ui.contrast).toBe('system')
    ui.applyPreferences({ theme: 'dark', locale: 'fr' }) // no `contrast` key, like an old archive
    expect(ui.contrast).toBe('system')
  })

  it('leaves a current contrast value untouched (not reset to default) when applying an old-format payload', () => {
    const ui = useUiStore()
    ui.contrast = 'high'
    ui.applyPreferences({ theme: 'dark', locale: 'fr' }) // no `contrast` key, like an old archive
    expect(ui.contrast).toBe('high') // unknown/absent field left untouched, not reset
  })
})

describe('ui store preferences export/apply (workspace backup)', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => { localStorage.clear() })

  it('exports a snapshot of the current preferences', () => {
    const ui = useUiStore()
    ui.theme = 'dark'
    ui.accent = 'teal'
    ui.contrast = 'high'
    ui.locale = 'fr'
    ui.previewPreset = 'phone'
    ui.dismissedCallouts = ['a', 'b']

    const prefs = ui.exportPreferences()
    expect(prefs).toMatchObject({
      theme: 'dark', accent: 'teal', contrast: 'high', locale: 'fr', previewPreset: 'phone', dismissedCallouts: ['a', 'b'],
    })
    // Snapshot is detached — mutating it must not touch the store.
    prefs.dismissedCallouts.push('c')
    expect(ui.dismissedCallouts).toEqual(['a', 'b'])
  })

  it('applies valid preferences and persists them', async () => {
    const ui = useUiStore()
    ui.applyPreferences({
      theme: 'light',
      accent: 'rose',
      contrast: 'high',
      locale: 'es',
      previewPreset: 'tablet',
      paletteVisible: false,
      dismissedCallouts: ['x'],
      storageHintDismissed: true,
    })
    expect(ui.theme).toBe('light')
    expect(ui.accent).toBe('rose')
    expect(ui.contrast).toBe('high')
    expect(ui.locale).toBe('es')
    expect(ui.previewPreset).toBe('tablet')
    expect(ui.paletteVisible).toBe(false)
    expect(ui.dismissedCallouts).toEqual(['x'])

    await nextTick()
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) as string) as { theme: string, locale: string }
    expect(parsed.theme).toBe('light')
    expect(parsed.locale).toBe('es')
  })

  it('ignores invalid or unknown preference fields, keeping current values', () => {
    const ui = useUiStore()
    ui.theme = 'dark'
    ui.accent = 'green'
    ui.contrast = 'high'
    ui.applyPreferences({ theme: 'auto', accent: 'orange', contrast: 'extreme', locale: '', bogus: 1, paletteWidth: 'wide' })
    expect(ui.theme).toBe('dark')
    expect(ui.accent).toBe('green')
    expect(ui.contrast).toBe('high')
    expect(ui.locale).toBe('en')
  })

  it('ignores a non-object payload', () => {
    const ui = useUiStore()
    ui.theme = 'dark'
    ui.applyPreferences(null)
    ui.applyPreferences('nope')
    expect(ui.theme).toBe('dark')
  })

  it('clamps out-of-range panel widths on apply', () => {
    const ui = useUiStore()
    ui.applyPreferences({ paletteWidth: 99999 })
    // Clamped to the palette max (340), not stored raw.
    expect(ui.paletteWidth).toBe(340)
  })
})

describe('ui store hidden bundled templates', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => { localStorage.clear() })

  it('hides, unhides, and resets bundled templates without duplicating an id on double-hide', () => {
    const ui = useUiStore()
    expect(ui.hiddenBundledTemplates).toEqual([])
    expect(ui.isBundledTemplateHidden('welcome-survey')).toBe(false)

    ui.hideBundledTemplate('welcome-survey')
    ui.hideBundledTemplate('welcome-survey') // double-hide: no duplicate entry
    expect(ui.hiddenBundledTemplates).toEqual(['welcome-survey'])
    expect(ui.isBundledTemplateHidden('welcome-survey')).toBe(true)

    ui.hideBundledTemplate('household-roster')
    expect(ui.hiddenBundledTemplates).toEqual(['welcome-survey', 'household-roster'])

    ui.unhideBundledTemplate('welcome-survey')
    expect(ui.hiddenBundledTemplates).toEqual(['household-roster'])
    expect(ui.isBundledTemplateHidden('welcome-survey')).toBe(false)

    // Unhiding an id that was never hidden is a no-op, not an error.
    ui.unhideBundledTemplate('never-hidden')
    expect(ui.hiddenBundledTemplates).toEqual(['household-roster'])

    ui.resetHiddenBundledTemplates()
    expect(ui.hiddenBundledTemplates).toEqual([])
  })

  it('restores a persisted hidden-templates list in a fresh store', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, hiddenBundledTemplates: ['welcome-survey'] }))
    setActivePinia(createPinia())

    expect(useUiStore().hiddenBundledTemplates).toEqual(['welcome-survey'])
  })

  it('falls back to an empty list when the persisted hiddenBundledTemplates is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, hiddenBundledTemplates: 'welcome-survey' }))
    setActivePinia(createPinia())

    expect(useUiStore().hiddenBundledTemplates).toEqual([])
  })

  it('drops non-string entries from a malformed persisted hiddenBundledTemplates array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      hiddenBundledTemplates: ['welcome-survey', 42, null, { id: 'x' }, 'household-roster'],
    }))
    setActivePinia(createPinia())

    expect(useUiStore().hiddenBundledTemplates).toEqual(['welcome-survey', 'household-roster'])
  })

  it('ignores a non-array hiddenBundledTemplates on applyPreferences, keeping the current list', () => {
    const ui = useUiStore()
    ui.hideBundledTemplate('welcome-survey')
    ui.applyPreferences({ hiddenBundledTemplates: 'not-an-array' })
    expect(ui.hiddenBundledTemplates).toEqual(['welcome-survey'])
  })

  it('drops non-string entries when applyPreferences receives a malformed hiddenBundledTemplates array', () => {
    const ui = useUiStore()
    ui.applyPreferences({ hiddenBundledTemplates: ['welcome-survey', 42, null, 'household-roster'] })
    expect(ui.hiddenBundledTemplates).toEqual(['welcome-survey', 'household-roster'])
  })

  it('survives an exportPreferences -> applyPreferences round trip', () => {
    const source = useUiStore()
    source.hideBundledTemplate('welcome-survey')
    source.hideBundledTemplate('household-roster')

    const prefs = source.exportPreferences()
    expect(prefs.hiddenBundledTemplates).toEqual(['welcome-survey', 'household-roster'])

    // A fresh store (e.g. restoring on another device) starts empty, then
    // adopts the exported list on apply.
    setActivePinia(createPinia())
    const target = useUiStore()
    expect(target.hiddenBundledTemplates).toEqual([])
    target.applyPreferences(prefs)
    expect(target.hiddenBundledTemplates).toEqual(['welcome-survey', 'household-roster'])
  })

  it('pins the storage version at 1 — a bump would silently wipe every saved preference, including hidden templates', () => {
    // STORAGE_VERSION is private to the store, so this pins it indirectly: a
    // persisted blob at version 1 must still restore. If STORAGE_VERSION were
    // ever bumped without a migration, loadPersisted would reject this blob as
    // a version mismatch and hiddenBundledTemplates would silently fall back
    // to [] instead — the exact regression this test guards against.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, hiddenBundledTemplates: ['welcome-survey'] }))
    setActivePinia(createPinia())

    expect(useUiStore().hiddenBundledTemplates).toEqual(['welcome-survey'])
  })
})

describe('ui store last export format', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => { localStorage.clear() })

  it('sets and gets a per-form export format, returning null for an unknown form', () => {
    const ui = useUiStore()
    expect(ui.getLastExportFormat('rec1')).toBeNull()

    ui.setLastExportFormat('rec1', 'xlsform')
    expect(ui.getLastExportFormat('rec1')).toBe('xlsform')
    expect(ui.getLastExportFormat('rec2')).toBeNull()
  })

  it('skips the write (same map reference) when re-setting the already-stored format', () => {
    const ui = useUiStore()
    ui.setLastExportFormat('rec1', 'xlsform')
    const before = ui.lastExportFormat
    ui.setLastExportFormat('rec1', 'xlsform')
    expect(ui.lastExportFormat).toBe(before)
  })

  it('overwrites the remembered format for a form on a second set', () => {
    const ui = useUiStore()
    ui.setLastExportFormat('rec1', 'xlsform')
    ui.setLastExportFormat('rec1', 'zip-xform')
    expect(ui.getLastExportFormat('rec1')).toBe('zip-xform')
  })

  it('forgets a remembered format; forgetting an absent id is a no-op', () => {
    const ui = useUiStore()
    ui.setLastExportFormat('rec1', 'xlsform')
    ui.forgetExportFormat('rec1')
    expect(ui.getLastExportFormat('rec1')).toBeNull()

    ui.forgetExportFormat('never-set')
    expect(ui.getLastExportFormat('never-set')).toBeNull()
  })

  it('persists the map to localStorage when it changes', async () => {
    const ui = useUiStore()
    ui.setLastExportFormat('rec1', 'xlsform')
    await nextTick()

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string) as { lastExportFormat: Record<string, string> }
    expect(parsed.lastExportFormat).toEqual({ rec1: 'xlsform' })
  })

  it('restores a persisted map in a fresh store', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, lastExportFormat: { rec1: 'zip-xform' } }))
    setActivePinia(createPinia())

    expect(useUiStore().getLastExportFormat('rec1')).toBe('zip-xform')
  })

  it('drops unrecognised formats and non-string values from a malformed persisted map', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      lastExportFormat: { good: 'xlsform', bad: 'pdf', n: 5 },
    }))
    setActivePinia(createPinia())

    expect(useUiStore().lastExportFormat).toEqual({ good: 'xlsform' })
  })

  it('pins the storage version at 1 — a bump would silently wipe every saved preference, including the export-format map', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, lastExportFormat: { rec1: 'xlsform' } }))
    setActivePinia(createPinia())

    expect(useUiStore().getLastExportFormat('rec1')).toBe('xlsform')
  })

  it('survives an exportPreferences -> applyPreferences round trip', () => {
    const source = useUiStore()
    source.setLastExportFormat('rec1', 'xlsform')
    source.setLastExportFormat('rec2', 'zip-xform')

    const prefs = source.exportPreferences()
    expect(prefs.lastExportFormat).toEqual({ rec1: 'xlsform', rec2: 'zip-xform' })

    setActivePinia(createPinia())
    const target = useUiStore()
    expect(target.lastExportFormat).toEqual({})
    target.applyPreferences(prefs)
    expect(target.lastExportFormat).toEqual({ rec1: 'xlsform', rec2: 'zip-xform' })
  })

  it('ignores a non-object lastExportFormat on applyPreferences, keeping the current map', () => {
    const ui = useUiStore()
    ui.setLastExportFormat('rec1', 'xlsform')
    ui.applyPreferences({ lastExportFormat: 'not-an-object' })
    expect(ui.lastExportFormat).toEqual({ rec1: 'xlsform' })
  })

  it('drops malformed entries when applyPreferences receives a mixed-validity lastExportFormat map', () => {
    const ui = useUiStore()
    ui.applyPreferences({ lastExportFormat: { good: 'xlsform', bad: 'pdf' } })
    expect(ui.lastExportFormat).toEqual({ good: 'xlsform' })
  })
})
