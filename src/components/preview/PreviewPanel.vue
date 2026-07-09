<script setup lang="ts">
import Button from 'primevue/button'
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import PreviewHost from '@/components/preview/PreviewHost.vue'
import SubmissionResultDialog from '@/components/preview/SubmissionResultDialog.vue'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'
import { usePreviewStore } from '@/stores/preview'

const form = useFormStore()
const editor = useEditorStore()
const preview = usePreviewStore()
const router = useRouter()

onMounted(() => { preview.start() })

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

const openFullPreview = (): void => {
  if (form.recordId !== null) {
    void router.push({ name: 'preview', params: { formId: form.recordId } })
  }
}
</script>

<template>
  <aside class="preview-panel" aria-label="Live preview" data-testid="preview-panel">
    <header class="preview-panel-header">
      <span class="preview-title">Preview</span>
      <span class="preview-actions">
        <Button
          v-tooltip.bottom="'Refresh preview'"
          icon="pi pi-refresh"
          severity="secondary"
          text
          size="small"
          aria-label="Refresh preview"
          data-testid="preview-refresh"
          @click="preview.refreshNow()"
        />
        <Button
          v-tooltip.bottom="'Open full-page preview'"
          icon="pi pi-window-maximize"
          severity="secondary"
          text
          size="small"
          aria-label="Open full-page preview"
          @click="openFullPreview"
        />
        <Button
          icon="pi pi-times"
          severity="secondary"
          text
          size="small"
          aria-label="Close preview"
          data-testid="preview-close"
          @click="editor.previewVisible = false"
        />
      </span>
    </header>

    <div v-if="preview.status === 'invalid' && !preview.hasPreview" class="preview-message" data-testid="preview-invalid">
      <i class="pi pi-exclamation-triangle" />
      <p>Fix the form's errors to see the preview.</p>
    </div>
    <div v-else-if="!preview.hasPreview" class="preview-message">
      <i class="pi pi-eye" />
      <p>The preview appears once the form has questions.</p>
    </div>

    <template v-else>
      <div v-if="preview.status === 'invalid' && preview.stale" class="preview-banner warning" data-testid="preview-stale-banner">
        Preview is out of date — fix the form's errors to refresh it.
      </div>
      <div v-else-if="preview.engineError !== null" class="preview-banner error" data-testid="preview-engine-error">
        The form engine rejected this form: {{ preview.engineError }}
      </div>
      <PreviewHost
        v-if="form.recordId !== null && preview.xml !== null"
        :form-xml="preview.xml"
        :form-record-id="form.recordId"
        :instance-key="preview.instanceKey"
        @engine-error="preview.reportEngineError"
        @submit="onSubmit"
      />
    </template>

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
  border-left: var(--builder-panel-border);
  background: var(--odk-light-background-color);
}

.preview-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--odk-spacing-s) var(--odk-spacing-m);
  border-bottom: var(--builder-panel-border);
  background: var(--odk-base-background-color);
}

.preview-title {
  font-weight: 500;
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
