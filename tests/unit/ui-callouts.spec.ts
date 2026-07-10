// @vitest-environment happy-dom
// happy-dom (not the unit project's node env) so the ui store has
// localStorage to persist into and a window for its viewport clamps.
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { useUiStore } from '@/stores/ui'

const STORAGE_KEY = 'odk-builder:ui:v1'

describe('ui store dismissed-callouts persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('starts with no dismissed callouts when storage is empty', () => {
    const ui = useUiStore()
    expect(ui.dismissedCallouts).toEqual([])
    expect(ui.isCalloutDismissed('translations')).toBe(false)
  })

  it('dismissCallout records the id and isCalloutDismissed reflects it', () => {
    const ui = useUiStore()
    ui.dismissCallout('translations')

    expect(ui.dismissedCallouts).toEqual(['translations'])
    expect(ui.isCalloutDismissed('translations')).toBe(true)
    expect(ui.isCalloutDismissed('logicRaw')).toBe(false)
  })

  it('dismissing the same id twice does not duplicate it', () => {
    const ui = useUiStore()
    ui.dismissCallout('logicRaw')
    ui.dismissCallout('logicRaw')

    expect(ui.dismissedCallouts).toEqual(['logicRaw'])
  })

  it('persists dismissals to localStorage', async () => {
    const ui = useUiStore()
    ui.dismissCallout('translations')
    await nextTick()

    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    const state = JSON.parse(raw as string) as { dismissedCallouts: string[] }
    expect(state.dismissedCallouts).toEqual(['translations'])
  })

  it('a fresh store constructed after a persisted dismiss reports the id dismissed', async () => {
    const first = useUiStore()
    first.dismissCallout('translations')
    first.dismissCallout('logicRaw')
    await nextTick()

    // Simulate a reload: new pinia, new store instance, same localStorage.
    setActivePinia(createPinia())
    const reloaded = useUiStore()

    expect(reloaded.isCalloutDismissed('translations')).toBe(true)
    expect(reloaded.isCalloutDismissed('logicRaw')).toBe(true)
    expect(reloaded.dismissedCallouts).toEqual(['translations', 'logicRaw'])
  })

  it('ignores non-string entries in the persisted array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      dismissedCallouts: ['translations', 42, null, 'logicRaw'],
    }))
    setActivePinia(createPinia())

    expect(useUiStore().dismissedCallouts).toEqual(['translations', 'logicRaw'])
  })

  it('falls back to none dismissed when the persisted value is not an array', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      dismissedCallouts: 'translations',
    }))
    setActivePinia(createPinia())

    expect(useUiStore().dismissedCallouts).toEqual([])
  })
})
