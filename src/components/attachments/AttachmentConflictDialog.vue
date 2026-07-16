<script setup lang="ts">
/**
 * Upload-conflict prompt: shown when a general "Upload files" pick collides
 * with an existing attachment's filename. Offers Replace / Keep both / Skip,
 * plus an "apply to all remaining" fast path for multi-file batches — the
 * caller (AttachmentsDialog) drives one instance of this dialog through a
 * queue of colliding files.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import { ref, watch } from 'vue'

import { useAppI18n } from '@/i18n'

export type ConflictAction = 'replace' | 'keep-both' | 'skip'

const props = defineProps<{
  file: File | null
  /** Files still queued after this one — drives whether "apply to all" is offered. */
  remaining: number
}>()
const emit = defineEmits<{
  resolve: [payload: { action: ConflictAction, applyToRemaining: boolean }]
}>()

const { t } = useAppI18n()
const applyToRemaining = ref(false)

// Reset the checkbox for each new file the queue presents.
watch(() => props.file, () => { applyToRemaining.value = false })

const resolve = (action: ConflictAction): void => {
  emit('resolve', { action, applyToRemaining: applyToRemaining.value })
}
</script>

<template>
  <Dialog
    :visible="file !== null"
    :header="file !== null ? t('dialogs.attachments.conflict.header', { filename: file.name }) : ''"
    modal
    :closable="false"
    :style="{ width: '26rem' }"
    data-testid="attachment-conflict-dialog"
  >
    <div v-if="file !== null" class="attachment-conflict">
      <p>{{ t('dialogs.attachments.conflict.body', { filename: file.name }) }}</p>

      <label v-if="remaining > 0" class="prop-toggle">
        <Checkbox v-model="applyToRemaining" binary data-testid="attachment-conflict-apply-all" />
        <span>{{ t('dialogs.attachments.conflict.applyToAll', { count: remaining }) }}</span>
      </label>
    </div>

    <template #footer>
      <Button
        :label="t('dialogs.attachments.conflict.skip')"
        severity="secondary"
        text
        data-testid="attachment-conflict-skip"
        @click="resolve('skip')"
      />
      <Button
        :label="t('dialogs.attachments.conflict.keepBoth')"
        severity="secondary"
        data-testid="attachment-conflict-keep-both"
        @click="resolve('keep-both')"
      />
      <Button
        :label="t('dialogs.attachments.conflict.replace')"
        data-testid="attachment-conflict-replace"
        @click="resolve('replace')"
      />
    </template>
  </Dialog>
</template>

<style scoped>
@import '../properties/prop-section.css';

.attachment-conflict {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-l);
}

.attachment-conflict p {
  margin: 0;
  color: var(--odk-muted-text-color);
}
</style>
