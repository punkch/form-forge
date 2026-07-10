import { describe, expect, it } from 'vitest'

import { decide, RELOAD_GRACE_MS, type UpdateContext } from '@/pwa/updatePolicy'
import type { SaveState } from '@/stores/form'

const ctx = (overrides: Partial<UpdateContext>): UpdateContext => ({
  msSinceLoad: RELOAD_GRACE_MS + 1,
  editorOpen: true,
  saveState: 'dirty',
  ...overrides,
})

describe('pwa update policy', () => {
  it('reloads when the update is found right at page load, even mid-edit', () => {
    expect(decide(ctx({ msSinceLoad: 0 }))).toBe('reload')
    expect(decide(ctx({ msSinceLoad: RELOAD_GRACE_MS }))).toBe('reload')
  })

  it('reloads when no editor is open, whatever the save state', () => {
    for (const saveState of ['saved', 'saving', 'dirty', 'error'] as SaveState[]) {
      expect(decide(ctx({ editorOpen: false, saveState }))).toBe('reload')
    }
  })

  it('reloads mid-session in the editor once autosave has settled', () => {
    expect(decide(ctx({ saveState: 'saved' }))).toBe('reload')
  })

  it('defers to a toast only for an unsettled edit in the editor', () => {
    for (const saveState of ['saving', 'dirty', 'error'] as SaveState[]) {
      expect(decide(ctx({ saveState }))).toBe('toast')
    }
  })

  it('full decision table', () => {
    const table: Array<[number, boolean, SaveState, 'reload' | 'toast']> = [
      [0, true, 'dirty', 'reload'], // grace period wins
      [0, false, 'saved', 'reload'],
      [RELOAD_GRACE_MS + 1, false, 'dirty', 'reload'], // not editing
      [RELOAD_GRACE_MS + 1, true, 'saved', 'reload'], // nothing unsaved
      [RELOAD_GRACE_MS + 1, true, 'dirty', 'toast'],
      [RELOAD_GRACE_MS + 1, true, 'saving', 'toast'],
      [RELOAD_GRACE_MS + 1, true, 'error', 'toast'],
    ]
    for (const [msSinceLoad, editorOpen, saveState, expected] of table) {
      expect(decide({ msSinceLoad, editorOpen, saveState })).toBe(expected)
    }
  })
})
