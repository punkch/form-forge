<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import PreviewErrorState from '@/components/preview/PreviewErrorState.vue'
import PreviewHost from '@/components/preview/PreviewHost.vue'
import PreviewToolbar from '@/components/preview/PreviewToolbar.vue'
import SubmissionResultDialog from '@/components/preview/SubmissionResultDialog.vue'
import { useAppI18n } from '@/i18n'
import { buildFollowTarget } from '@/preview/followSelection'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'
import { usePreviewStore } from '@/stores/preview'
import { PREVIEW_PRESET_WIDTHS, useUiStore } from '@/stores/ui'

const { t } = useAppI18n()
const form = useFormStore()
const preview = usePreviewStore()
const ui = useUiStore()
const editor = useEditorStore()

const hostRef = ref<InstanceType<typeof PreviewHost> | null>(null)

onMounted(() => { preview.start() })

/** Scroll the preview to the question matching the canvas selection.
 * `flash` distinguishes a deliberate selection change (highlight it) from a
 * post-reload re-follow (just restore scroll position, no highlight). No
 * retry timers — a selection made mid-load is picked up by the next `loaded`,
 * and a false return (unresolved match) is deliberately ignored. */
const follow = (flash: boolean): void => {
  void nextTick(() => {
    if (hostRef.value === null || editor.selectedNodeId === null || form.doc === null) return
    const target = buildFollowTarget(form.doc, editor.selectedNodeId)
    if (target === null) return
    hostRef.value.followQuestion(target, { flash })
  })
}

watch(() => editor.selectedNodeId, (id) => { if (id !== null) follow(true) })

const contentWidth = computed(() =>
  ui.previewPreset === 'fill' ? '100%' : `${PREVIEW_PRESET_WIDTHS[ui.previewPreset]}px`
)

/** Engine failed and the host has nothing good to fall back to. */
const engineFatal = computed(() =>
  preview.engineError !== null && !preview.engineErrorRecovered
)

const submissionVisible = ref(false)
const submissionPayload = ref<unknown>(null)
let submissionCallback: ((outcome?: unknown) => void) | null = null

const onSubmit = (payload: unknown, callback: (outcome?: unknown) => void): void => {
  submissionPayload.value = payload
  submissionCallback = callback
  submissionVisible.value = true
}

const startNewInstance = async (): Promise<void> => {
  submissionVisible.value = false
  const { POST_SUBMIT__NEW_INSTANCE } = await import('@getodk/web-forms')
  submissionCallback?.({ next: POST_SUBMIT__NEW_INSTANCE })
  submissionCallback = null
}
</script>

<template>
  <aside class="preview-panel" :aria-label="t('preview.panel.ariaLabel')" data-testid="preview-panel">
    <PreviewToolbar />

    <!-- Paused banner only makes sense over a mounted (stale) preview; a
         blank form shows just the friendly empty state below. -->
    <div v-if="preview.blockReason !== null && preview.hasPreview" class="preview-banner warning" data-testid="preview-paused-banner">
      {{ preview.blockReason }}
    </div>
    <div v-else-if="preview.hasPreview && preview.status === 'invalid' && preview.stale" class="preview-banner warning" data-testid="preview-stale-banner">
      {{ t('preview.panel.stale') }}
    </div>
    <div v-else-if="preview.hasPreview && preview.engineError !== null && !engineFatal" class="preview-banner error" data-testid="preview-engine-error">
      {{ t('preview.panel.engineRejected', { message: preview.engineError }) }}
    </div>

    <PreviewErrorState v-if="engineFatal" />
    <div v-else-if="preview.status === 'invalid' && preview.blockReason === null && !preview.hasPreview" class="preview-message" data-testid="preview-invalid">
      <i class="pi pi-exclamation-triangle" />
      <p>{{ t('preview.panel.fixErrors') }}</p>
    </div>
    <div v-else-if="!preview.hasPreview" class="preview-message" data-testid="preview-empty">
      <i class="pi pi-eye" />
      <p>{{ t('preview.panel.emptyHint') }}</p>
    </div>
    <PreviewHost
      v-else-if="form.recordId !== null && preview.xml !== null"
      ref="hostRef"
      :form-xml="preview.xml"
      :form-record-id="form.recordId"
      :instance-key="preview.instanceKey"
      :content-width="contentWidth"
      @engine-error="preview.reportEngineError"
      @submit="onSubmit"
      @loaded="follow(false)"
    />

    <SubmissionResultDialog
      v-model:visible="submissionVisible"
      :payload="submissionPayload"
      @new-instance="startNewInstance"
    />
  </aside>
</template>

<style scoped>
.preview-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-inline-start: var(--builder-panel-border);
  background: var(--odk-light-background-color);
}

.preview-message {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--odk-spacing-m);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
  text-align: center;
  padding: var(--odk-spacing-xl);
}

.preview-message i {
  font-size: 2rem;
  color: var(--odk-light-muted-text-color);
}

.preview-banner {
  padding: var(--odk-spacing-s) var(--odk-spacing-m);
  font-size: var(--odk-hint-font-size);
}

.preview-banner.warning {
  background: var(--odk-warning-background-color);
  color: var(--odk-warning-text-color);
}

.preview-banner.error {
  background: var(--odk-error-background-color);
  color: var(--odk-error-text-color);
}
</style>
