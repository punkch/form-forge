<script setup lang="ts">
import Button from 'primevue/button'
import { onMounted, ref, toRaw } from 'vue'
import { useRouter } from 'vue-router'

import PreviewHost from '@/components/preview/PreviewHost.vue'
import SubmissionResultDialog from '@/components/preview/SubmissionResultDialog.vue'
import { serializeXForm } from '@/core/xform/serializer'
import { getForm } from '@/persistence/forms-repo'

const props = defineProps<{ formId: string }>()

const router = useRouter()

const xml = ref<string | null>(null)
const title = ref('')
const error = ref<string | null>(null)

onMounted(async () => {
  const record = await getForm(props.formId)
  if (record === undefined) {
    error.value = 'This form does not exist in this browser\'s storage.'
    return
  }
  title.value = record.title
  const result = serializeXForm(toRaw(record.doc))
  if (result.issues.some((i) => i.severity === 'error')) {
    error.value = 'The form has errors — fix them in the editor to preview it.'
    return
  }
  xml.value = result.xml
})

const backToEditor = (): void => {
  void router.push({ name: 'editor', params: { formId: props.formId } })
}

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
  <div class="full-preview">
    <header class="full-preview-bar">
      <Button
        icon="pi pi-arrow-left"
        label="Back to editor"
        severity="secondary"
        text
        data-testid="back-to-editor"
        @click="backToEditor"
      />
      <span class="full-preview-title">{{ title }}</span>
      <span class="full-preview-hint">Test preview — submissions stay on this device</span>
    </header>

    <main class="full-preview-body">
      <div v-if="error !== null" class="full-preview-error">
        <i class="pi pi-exclamation-triangle" />
        <p>{{ error }}</p>
      </div>
      <PreviewHost
        v-else-if="xml !== null"
        :form-xml="xml"
        :form-record-id="props.formId"
        :instance-key="0"
        @submit="onSubmit"
        @engine-error="error = $event"
      />
    </main>

    <SubmissionResultDialog
      v-model:visible="submissionVisible"
      :payload="submissionPayload"
      @new-instance="startNewInstance"
    />
  </div>
</template>

<style scoped>
.full-preview {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.full-preview-bar {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-l);
  padding: var(--odk-spacing-s) var(--odk-spacing-l);
  border-bottom: var(--builder-panel-border);
}

.full-preview-bar > :deep(.p-button) {
  flex-shrink: 0;
  white-space: nowrap;
}

.full-preview-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.full-preview-hint {
  margin-left: auto;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
  text-align: right;
}

@media (max-width: 767px) {
  .full-preview-hint {
    display: none;
  }
}

.full-preview-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.full-preview-body > :deep(.preview-host) {
  flex: 1;
}

.full-preview-error {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--odk-spacing-m);
  color: var(--odk-muted-text-color);
}
</style>
