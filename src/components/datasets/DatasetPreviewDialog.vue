<script setup lang="ts">
// Standalone modal shell around AttachmentPreview (editor.activeDialog ===
// 'dataset-preview') — the properties panel's "View file" path, where no
// other dialog is open underneath. The Attachments dialog previews in place
// instead (drill-in view), so it never opens this one.
import Dialog from 'primevue/dialog'
import { computed } from 'vue'

import AttachmentPreview from '@/components/datasets/AttachmentPreview.vue'
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'

const { t } = useAppI18n()
const editor = useEditorStore()

const visible = computed({
  get: () => editor.activeDialog === 'dataset-preview',
  set: (open: boolean) => { editor.activeDialog = open ? 'dataset-preview' : null },
})

const filename = computed(() => editor.datasetPreviewFilename ?? '')
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="t('dialogs.datasetPreview.header', { filename })"
    modal
    :style="{ width: '52rem', maxWidth: '95vw' }"
    data-testid="dataset-preview-dialog"
  >
    <AttachmentPreview v-if="visible" :filename="filename" />
  </Dialog>
</template>
