import type { SaveState } from '@/stores/form'

/** Updates found this soon after page load apply silently — the user has not
 * started doing anything yet, so a reload is invisible. */
export const RELOAD_GRACE_MS = 3000

export interface UpdateContext {
  /** Milliseconds since the page loaded when the update was discovered. */
  msSinceLoad: number
  /** Whether a form is currently open for editing. */
  editorOpen: boolean
  /** Autosave state of the open form ('saved' when nothing is pending). */
  saveState: SaveState
}

export type UpdateAction = 'reload' | 'toast'

/**
 * Hybrid update policy (docs/specs/backlog/pwa-packaging.md): apply and
 * reload automatically whenever it cannot lose work — right at page load,
 * outside the editor, or with autosave settled. Only an unsaved mid-edit
 * defers to a sticky toast (plus auto-apply on the next return to the
 * library, wired in registerSW.ts).
 */
export const decide = ({ msSinceLoad, editorOpen, saveState }: UpdateContext): UpdateAction =>
  msSinceLoad <= RELOAD_GRACE_MS || !editorOpen || saveState === 'saved' ? 'reload' : 'toast'
