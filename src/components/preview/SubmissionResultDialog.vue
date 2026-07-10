<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { ref, watch } from 'vue'

import { useAppI18n } from '@/i18n'

const { t } = useAppI18n()

const props = defineProps<{
  visible: boolean
  payload: unknown
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  'new-instance': []
}>()

const toast = useToast()
const instanceXml = ref('')

/** Best-effort extraction of the instance XML from the submission payload. */
const extractInstanceXml = async (payload: unknown): Promise<string> => {
  try {
    const data = (payload as { data?: unknown })?.data
    const parts = Array.isArray(data) ? data : [data]
    for (const part of parts) {
      if (part instanceof Blob) return await part.text()
      if (typeof FormData !== 'undefined' && part instanceof FormData) {
        for (const value of part.values()) {
          if (value instanceof Blob) return await value.text()
        }
      }
    }
    return JSON.stringify(payload, (_key, value) =>
      value instanceof Blob ? `(blob ${value.size} bytes)` : value, 2)
  } catch (error) {
    return t('preview.submission.readFailed', { error: String(error) })
  }
}

watch(() => props.payload, async (payload) => {
  if (payload !== null && payload !== undefined) {
    instanceXml.value = await extractInstanceXml(payload)
  }
}, { immediate: true })

const copy = async (): Promise<void> => {
  await navigator.clipboard.writeText(instanceXml.value)
  toast.add({ severity: 'success', summary: t('preview.submission.copied'), life: 2000 })
}

const download = (): void => {
  const blob = new Blob([instanceXml.value], { type: 'text/xml' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'submission.xml'
  anchor.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <Dialog
    :visible="visible"
    :header="t('preview.submission.header')"
    modal
    :style="{ width: '42rem' }"
    @update:visible="emit('update:visible', $event)"
  >
    <p class="submission-note">
      {{ t('preview.submission.note') }}
    </p>
    <pre class="submission-xml" data-testid="submission-xml">{{ instanceXml }}</pre>
    <template #footer>
      <Button :label="t('preview.submission.copyXml')" icon="pi pi-copy" severity="secondary" text @click="copy" />
      <Button :label="t('preview.submission.download')" icon="pi pi-download" severity="secondary" text @click="download" />
      <Button
        :label="t('preview.submission.newInstance')"
        icon="pi pi-replay"
        data-testid="submission-new-instance"
        @click="emit('new-instance')"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.submission-note {
  margin: 0 0 var(--odk-spacing-m);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.submission-xml {
  margin: 0;
  padding: var(--odk-spacing-m);
  background: var(--odk-light-background-color);
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
  font-size: 0.8rem;
  max-height: 50vh;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
