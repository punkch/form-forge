<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, ref, watch } from 'vue'

import type { AttachmentRole } from '@/core/model/types'
import * as attachmentsRepo from '@/persistence/attachments-repo'
import type { AttachmentRecord } from '@/persistence/db'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const form = useFormStore()
const editor = useEditorStore()

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

const roleFor = (filename: string, mediatype: string): AttachmentRole => {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'csv') return 'csv'
  if (ext === 'geojson') return 'geojson'
  if (ext === 'xml') return 'xml'
  if (mediatype.startsWith('image/') || mediatype.startsWith('audio/') || mediatype.startsWith('video/')) return 'media'
  return 'other'
}

const upload = async (event: Event): Promise<void> => {
  const files = (event.target as HTMLInputElement).files
  if (files === null || form.recordId === null) return
  for (const file of files) {
    const record = await attachmentsRepo.addAttachment(form.recordId, file.name, file)
    form.mutate('Add attachment', (d) => {
      // Replace an existing ref with the same filename (re-upload).
      d.attachments = d.attachments.filter((a) => a.filename !== file.name)
      d.attachments.push({
        id: record.id,
        filename: record.filename,
        mediatype: record.mediatype,
        size: record.size,
        role: roleFor(record.filename, record.mediatype),
      })
    })
  }
  ;(event.target as HTMLInputElement).value = ''
  await refresh()
}

const remove = async (record: AttachmentRecord): Promise<void> => {
  await attachmentsRepo.deleteAttachment(record.id)
  form.mutate('Remove attachment', (d) => {
    d.attachments = d.attachments.filter((a) => a.id !== record.id)
  })
  await refresh()
}

const formatSize = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
</script>

<template>
  <Dialog
    v-model:visible="visible"
    header="Form attachments"
    modal
    :style="{ width: '38rem' }"
    data-testid="attachments-dialog"
  >
    <p class="attachments-hint">
      Files referenced by the form — choice files for "select from file"
      questions, label media, external CSV datasets. They are bundled into
      the ZIP export and served to the live preview.
    </p>

    <div v-if="records.length === 0" class="attachments-empty">
      <i class="pi pi-paperclip" />
      <p>No attachments yet.</p>
    </div>

    <ul v-else class="attachments-list">
      <li v-for="record in records" :key="record.id">
        <i class="pi pi-file" />
        <span class="attachment-name">{{ record.filename }}</span>
        <span class="attachment-meta">{{ record.mediatype }} · {{ formatSize(record.size) }}</span>
        <Button
          icon="pi pi-trash"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-label="`Delete ${record.filename}`"
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
        label="Upload files"
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
  margin-left: auto;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.attachments-input {
  display: none;
}
</style>
