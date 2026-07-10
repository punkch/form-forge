/**
 * Durable-storage request, called once after the first successful autosave
 * (src/stores/form.ts): browsers grant `navigator.storage.persist()` far more
 * readily once the user has actually created content. One-shot per page load;
 * the granted state itself is queried fresh via `isStoragePersistent()`
 * wherever it is displayed (library footer).
 */

let requested = false

export const requestPersistentStorage = async (): Promise<boolean> => {
  if (requested) return false
  requested = true
  try {
    if (typeof navigator === 'undefined' || navigator.storage?.persist === undefined) return false
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/** Current persistence grant, or null when the API is unavailable. */
export const isStoragePersistent = async (): Promise<boolean | null> => {
  try {
    if (typeof navigator === 'undefined' || navigator.storage?.persisted === undefined) return null
    return await navigator.storage.persisted()
  } catch {
    return null
  }
}

/** Test hook: reset the one-shot latch. */
export const resetPersistentStorageRequest = (): void => {
  requested = false
}
