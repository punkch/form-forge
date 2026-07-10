import { useToast } from 'primevue/usetoast'
import { useRouter } from 'vue-router'

import { translate } from '@/i18n'
import { useFormStore } from '@/stores/form'

import { decide } from './updatePolicy'

/** Toast group rendered by the dedicated update <Toast> in App.vue. */
export const SW_UPDATE_TOAST_GROUP = 'sw-update'

/** Long-running sessions re-check the server for a new deployment hourly. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * When the service worker registers:
 * - production builds: always;
 * - the e2e build (VITE_E2E=1, still a prod build): only when the page URL
 *   opts in with `?pwa=1` — tests/e2e/pwa.spec.ts uses that flag while every
 *   other spec keeps running without a service worker in the way;
 * - dev: never (devOptions.enabled is false anyway).
 */
export const swRegistrationAllowed = (): boolean => {
  if (!import.meta.env.PROD) return false
  if (import.meta.env.VITE_E2E === '1') {
    return new URLSearchParams(window.location.search).has('pwa')
  }
  return true
}

export interface SwUpdateHandle {
  /** Apply a toast-deferred update now (Reload button in App.vue). */
  applyUpdate: () => void
}

/**
 * Call from App.vue setup. Registers the service worker (when allowed) and
 * drives the hybrid update policy: onNeedRefresh → decide() → immediate
 * update+reload, or a sticky toast; a toast-deferred update also auto-applies
 * on the next navigation back to the library (nothing mid-edit to lose).
 *
 * `virtual:pwa-register` is imported dynamically so environments without the
 * plugin (vitest) never have to resolve it.
 */
export const useSwUpdate = (): SwUpdateHandle => {
  const toast = useToast()
  const router = useRouter()
  const form = useFormStore()
  const loadedAt = Date.now()

  let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null
  let updatePending = false

  const applyUpdate = (): void => {
    updatePending = false
    void updateSW?.(true)
  }

  if (swRegistrationAllowed()) {
    void import('virtual:pwa-register').then(({ registerSW }) => {
      updateSW = registerSW({
        onNeedRefresh () {
          const action = decide({
            msSinceLoad: Date.now() - loadedAt,
            // Any open form counts as "editing" — the full preview keeps the
            // form store loaded too.
            editorOpen: form.recordId !== null,
            saveState: form.saveState,
          })
          if (action === 'reload') {
            applyUpdate()
            return
          }
          updatePending = true
          // No `life` → sticky; stays until reloaded or dismissed.
          toast.add({
            severity: 'info',
            group: SW_UPDATE_TOAST_GROUP,
            summary: translate('shell.pwa.updateReady'),
            detail: translate('shell.pwa.updateDetail'),
          })
        },
        onRegisteredSW (_url, registration) {
          if (registration !== undefined) {
            setInterval(() => { void registration.update() }, UPDATE_CHECK_INTERVAL_MS)
          }
        },
      })
    })

    router.afterEach((to) => {
      if (updatePending && to.name === 'library') applyUpdate()
    })
  }

  return { applyUpdate }
}
