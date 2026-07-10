import { defineStore } from 'pinia'
import { computed, effectScope, ref, toRaw, watch } from 'vue'

import { displayText } from '@/core/model/display'
import type { FormDocument } from '@/core/model/types'
import { scopeNodeId } from '@/core/validate'
import { serializeXForm } from '@/core/xform/serializer'
import { translate } from '@/i18n'

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
  /** True when PreviewHost reverted to the last good XML after the error. */
  const engineErrorRecovered = ref(false)
  /** Friendly reason regeneration is paused (empty group/repeat), or null. */
  const blockReason = ref<string | null>(null)
  /** Remount signal for PreviewHost. */
  const instanceKey = ref(0)
  const autoRefresh = ref(true)

  let timer: ReturnType<typeof setTimeout> | null = null
  let watching = false

  /**
   * Clear all preview state. Runs whenever the open form changes so a new
   * form can never show (or revert to) the previous form's XML.
   */
  const reset = (): void => {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    xml.value = null
    stale.value = false
    status.value = 'idle'
    engineError.value = null
    engineErrorRecovered.value = false
    blockReason.value = null
  }

  /**
   * A form with no questions at all serializes to an empty body — pause
   * instead of mounting the engine, so blank forms show the empty state.
   */
  const blankRootBlock = (): string | null =>
    form.doc !== null && form.doc.children.length === 0
      ? translate('stores.preview.pausedNoQuestions')
      : null

  /** Empty containers crash the engine — name the first one to pause on. */
  const emptyContainerBlock = (): string | null => {
    const issue = form.issues.find((i) => i.code === 'structure.empty-container')
    if (issue === undefined) return null
    const nodeId = scopeNodeId(issue.scope)
    const node = nodeId !== undefined ? form.getNode(nodeId) : null
    const name = node !== null
      ? (displayText(node.label) || node.name)
      : translate('stores.preview.containerFallback')
    return node?.kind === 'repeat'
      ? translate('stores.preview.pausedEmptyRepeat', { name })
      : translate('stores.preview.pausedEmptyGroup', { name })
  }

  const regenerate = (): void => {
    if (form.doc === null) return
    status.value = 'generating'
    blockReason.value = blankRootBlock() ?? emptyContainerBlock()
    // Model validation gates the preview (errors only; warnings pass).
    if (form.errorCount > 0) {
      status.value = 'invalid'
      stale.value = xml.value !== null
      return
    }
    // An empty group/repeat serializes to a body the engine rejects — pause
    // with the last good XML mounted instead of letting the engine crash.
    if (blockReason.value !== null) {
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
    engineErrorRecovered.value = false
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
    // Detached scope: start() runs from PreviewPanel's onMounted, where the
    // component's effect scope is active — without detaching, the watchers
    // would be disposed when the panel unmounts (e.g. navigating back to the
    // library) and the preview would go dead for the next form.
    const scope = effectScope(true)
    scope.run(() => {
      // The reset-before-regenerate guarantee holds because form.load() and
      // form.close() always write recordId before doc — watcher jobs created
      // outside a component flush in trigger order, not registration order.
      watch(() => form.recordId, () => { reset() })
      watch(() => form.doc, (value, old) => {
        if (value === null) return
        if (old === null || value !== old) { regenerate(); return }
        schedule()
      }, { deep: true })
    })
    regenerate()
  }

  const refreshNow = (): void => {
    if (timer !== null) clearTimeout(timer)
    regenerate()
  }

  const reportEngineError = (message: string, recovered = false): void => {
    engineError.value = message
    engineErrorRecovered.value = recovered
    status.value = 'engine-error'
  }

  const hasPreview = computed(() => xml.value !== null)

  return {
    xml,
    status,
    stale,
    engineError,
    engineErrorRecovered,
    blockReason,
    instanceKey,
    autoRefresh,
    hasPreview,
    start,
    reset,
    refreshNow,
    reportEngineError,
  }
})
