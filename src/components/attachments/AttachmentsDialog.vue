<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, ref, watch } from 'vue'

import { useAttachmentUpload } from '@/composables/useAttachmentUpload'
import { datasetFormatOf } from '@/core/datasets/parse'
import { useAppI18n } from '@/i18n'
import * as attachmentsRepo from '@/persistence/attachments-repo'
import type { AttachmentRecord } from '@/persistence/db'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const { t } = useAppI18n()
const form = useFormStore()
const editor = useEditorStore()
const { attachFile } = useAttachmentUpload()

const visible = computed({
  get: () => editor.activeDialog === 'attachments',
  set: (open: boolean) => { editor.activeDialog = open ? 'attachments' : null },
})

const records = ref<AttachmentRecord[]>([])
const fileInput = ref<HTMLInputElement | null>(null)

const refresh = async (): Promise<void> => {
  if (form.recordId !== null) records.value = await attachmentsRepo.listAttachments(form.recordId)
}

watch(visible, (open) => { if (open) void refresh() })

const upload = async (event: Event): Promise<void> => {
  const files = (event.target as HTMLInputElement).files
  if (files === null || form.recordId === null) return
  for (const file of files) await attachFile(file)
  ;(event.target as HTMLInputElement).value = ''
  await refresh()
}

const remove = async (record: AttachmentRecord): Promise<void> => {
  await attachmentsRepo.deleteAttachment(record.id)
  form.mutate(t('dialogs.attachments.undoRemove'), (d) => {
    d.attachments = d.attachments.filter((a) => a.id !== record.id)
  })
  await refresh()
}

const formatSize = (bytes: number): string =>
  bytes < 1024
    ? t('dialogs.attachments.sizeBytes', { size: bytes })
    : bytes < 1024 * 1024
      ? t('dialogs.attachments.sizeKilobytes', { size: (bytes / 1024).toFixed(1) })
      : t('dialogs.attachments.sizeMegabytes', { size: (bytes / 1024 / 1024).toFixed(1) })
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="t('dialogs.attachments.header')"
    modal
    :style="{ width: '38rem' }"
    data-testid="attachments-dialog"
  >
    <p class="attachments-hint">
      {{ t('dialogs.attachments.hint') }}
    </p>

    <div v-if="records.length === 0" class="attachments-empty">
      <i class="pi pi-paperclip" />
      <p>{{ t('dialogs.attachments.empty') }}</p>
    </div>

    <ul v-else class="attachments-list">
      <li v-for="record in records" :key="record.id">
        <i class="pi pi-file" />
        <span class="attachment-name">{{ record.filename }}</span>
        <span class="attachment-meta">{{ record.mediatype }} · {{ formatSize(record.size) }}</span>
        <Button
          v-if="datasetFormatOf(record.filename) !== undefined"
          icon="pi pi-eye"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-label="t('dialogs.attachments.viewFile', { filename: record.filename })"
          data-testid="attachment-view"
          @click="editor.openDatasetPreview(record.filename)"
        />
        <Button
          icon="pi pi-trash"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-label="t('dialogs.attachments.deleteFile', { filename: record.filename })"
          @click="remove(record)"
        />
      </li>
    </ul>

    <template #footer>
      <input
        ref="fileInput"
        type="file"
        multiple
        class="attachments-input"
        data-testid="attachment-file-input"
        @change="upload"
      >
      <Button
        :label="t('dialogs.attachments.upload')"
        icon="pi pi-upload"
        data-testid="attachment-upload"
        @click="fileInput?.click()"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.attachments-hint {
  margin: 0 0 var(--odk-spacing-l);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.attachments-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--odk-spacing-s);
  padding: var(--odk-spacing-xl);
  color: var(--odk-muted-text-color);
}

.attachments-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.attachments-list li {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
  padding: var(--odk-spacing-s) var(--odk-spacing-m);
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
}

.attachment-name {
  font-weight: 500;
}

.attachment-meta {
  margin-inline-start: auto;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.attachments-input {
  display: none;
}
</style>
