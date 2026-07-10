import { onMounted, ref, type Ref } from 'vue'

import { isStoragePersistent } from '@/pwa/persistentStorage'

/**
 * Durable-storage grant, probed once on mount: `true`/`false` once known, or
 * `null` while pending and when the API is absent (src/pwa/persistentStorage.ts).
 * Shared by the library footer and the settings About section.
 */
export const useStoragePersistence = (): Ref<boolean | null> => {
  const storagePersistent = ref<boolean | null>(null)
  onMounted(() => {
    void isStoragePersistent().then((granted) => { storagePersistent.value = granted })
  })
  return storagePersistent
}
