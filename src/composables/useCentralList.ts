import { ref, watch, type Ref, type WatchSource } from 'vue'

/**
 * Shared fetch-and-track engine for the Central pickers (project, form). Each
 * picker watches its own dependencies (a chosen server, or a server + project),
 * reloads the list on every change, and re-throws transport failures to its
 * parent. This centralises the two fiddly bits both pickers otherwise hand-roll:
 *
 *  - a monotonic request id, so a slow response for a now-superseded dependency
 *    can never overwrite the list (or clear the selection) for the current one;
 *  - resetting the list on every change and clearing a selection the new list
 *    no longer offers, while keeping a selection that is still valid.
 */
export interface CentralList<T> {
  items: Ref<T[]>
  loading: Ref<boolean>
}

export interface CentralListOptions<T, D> {
  /** Reactive dependencies the list is keyed on (e.g. the chosen server id). */
  deps: WatchSource<D>
  /** Whether `deps` are complete enough to fetch; when false the list clears. */
  ready: (deps: D) => boolean
  /** Fetch the list for the current (ready) dependencies. */
  fetch: (deps: D) => Promise<T[]>
  /** Whether the current selection still appears in the freshly fetched list. */
  selectionValid: (items: T[]) => boolean
  /** Drop the current selection (deps went unready, or it left the list). */
  clearSelection: () => void
  /** Surface a transport failure to the parent. */
  onError: (error: unknown) => void
}

export const useCentralList = <T, D>(options: CentralListOptions<T, D>): CentralList<T> => {
  const items = ref<T[]>([]) as Ref<T[]>
  const loading = ref(false)
  // Monotonic id so an out-of-order (stale) response can't overwrite the list
  // or selection for the dependencies that are now selected.
  let requestId = 0

  watch(options.deps, async (deps) => {
    const id = ++requestId
    items.value = []
    if (!options.ready(deps)) {
      options.clearSelection()
      return
    }
    loading.value = true
    try {
      const fetched = await options.fetch(deps)
      if (id !== requestId) return
      items.value = fetched
      if (!options.selectionValid(fetched)) options.clearSelection()
    } catch (error) {
      if (id === requestId) options.onError(error)
    } finally {
      if (id === requestId) loading.value = false
    }
  }, { immediate: true })

  return { items, loading }
}
