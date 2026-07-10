import { defineStore } from 'pinia'
import { ref } from 'vue'

import type { EmbedConfig } from '@/embed/protocol'
import { setLocale } from '@/i18n/setLocale'

/**
 * Embed-mode session state (see docs/specs/2026-07-09-2235-embed-postmessage-api).
 * `active`/`hostOrigin` are set once at boot from the URL by main.ts; `config`
 * accumulates the host's init/set-config payloads. Persistence backend
 * switching stays in the bridge — this store only owns config state and its
 * locale side effect.
 */
export const useEmbedStore = defineStore('embed', () => {
  const active = ref(false)
  const hostOrigin = ref<string | null>(null)
  const initialized = ref(false)
  const config = ref<EmbedConfig>({})

  /**
   * Merge a (partial) host config and apply its immediate side effects.
   * `exports` merges per key so a set-config carrying only some export flags
   * leaves the others as an earlier init/set-config set them (never re-enabling
   * a flag the host disabled before).
   */
  const applyConfig = (partial: EmbedConfig): void => {
    const merged: EmbedConfig = { ...config.value, ...partial }
    if (partial.exports !== undefined) {
      merged.exports = { ...config.value.exports, ...partial.exports }
    }
    config.value = merged
    if (partial.locale !== undefined) setLocale(partial.locale)
  }

  /** An export action is shown unless the host explicitly disabled it;
   * outside embed mode everything is always shown. */
  const exportEnabled = (kind: keyof Required<EmbedConfig>['exports']): boolean =>
    !active.value || config.value.exports?.[kind] !== false

  return {
    active,
    hostOrigin,
    initialized,
    config,
    applyConfig,
    exportEnabled,
  }
})
