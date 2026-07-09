import { defineStore } from 'pinia'
import { computed, ref, toRaw, watch } from 'vue'

import type { FormDocument } from '@/core/model/types'
import { serializeXForm } from '@/core/xform/serializer'

import { useFormStore } from './form'

export type PreviewStatus = 'idle' | 'generating' | 'ready' | 'invalid' | 'engine-error'

const DEBOUNCE_MS = 500

/**
 * Debounced XML regeneration for the live preview. Regeneration is gated on
 * zero validation errors; the last good XML stays visible (marked stale)
 * while the form is broken.
 */
export const usePreviewStore = defineStore('preview', () => {
  const form = useFormStore()

  const xml = ref<string | null>(null)
  const status = ref<PreviewStatus>('idle')
  /** True when xml no longer reflects the current document. */
  const stale = ref(false)
  const engineError = ref<string | null>(null)
  /** Remount signal for PreviewHost. */
  const instanceKey = ref(0)
  const autoRefresh = ref(true)

  let timer: ReturnType<typeof setTimeout> | null = null
  let watching = false

  const regenerate = (): void => {
    if (form.doc === null) return
    status.value = 'generating'
    // Model validation gates the preview (errors only; warnings pass).
    if (form.errorCount > 0) {
      status.value = 'invalid'
      stale.value = xml.value !== null
      return
    }
    const result = serializeXForm(toRaw(form.doc) as FormDocument)
    if (result.issues.some((i) => i.severity === 'error')) {
      status.value = 'invalid'
      stale.value = xml.value !== null
      return
    }
    xml.value = result.xml
    engineError.value = null
    stale.value = false
    status.value = 'ready'
    instanceKey.value++
  }

  const schedule = (): void => {
    stale.value = xml.value !== null
    if (!autoRefresh.value) return
    if (timer !== null) clearTimeout(timer)
    // Wait a beat longer than validation's 300ms debounce so errorCount is
    // current when we regenerate.
    timer = setTimeout(regenerate, DEBOUNCE_MS)
  }

  const start = (): void => {
    if (watching) { regenerate(); return }
    watching = true
    watch(() => form.doc, (value, old) => {
      if (value === null) return
      if (old === null || value !== old) { regenerate(); return }
      schedule()
    }, { deep: true })
    regenerate()
  }

  const refreshNow = (): void => {
    if (timer !== null) clearTimeout(timer)
    regenerate()
  }

  const reportEngineError = (message: string): void => {
    engineError.value = message
    status.value = 'engine-error'
  }

  const hasPreview = computed(() => xml.value !== null)

  return {
    xml,
    status,
    stale,
    engineError,
    instanceKey,
    autoRefresh,
    hasPreview,
    start,
    refreshNow,
    reportEngineError,
  }
})
