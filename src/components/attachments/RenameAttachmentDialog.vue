<script setup lang="ts">
/**
 * Small modal for renaming one attachment: edits only the filename stem —
 * the extension renders as a fixed, non-editable suffix (Decision 2: a
 * rename can never change what the file *is*). Confirming emits the full
 * new filename; the caller (AttachmentsDialog) is responsible for the
 * actual repo rename + document reference rewrite as one undo step.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { computed, ref, watch } from 'vue'

import { splitFilename } from '@/core/model/rename-attachment'
import type { AttachmentRef } from '@/core/model/types'
import { useAppI18n } from '@/i18n'

const props = defineProps<{
  attachment: AttachmentRef | null
  existingFilenames: string[]
  /** References to the OLD filename, supplied by the parent's already-built
   * refCounts map — the count doesn't change while the user types the stem. */
  referenceCount: number
}>()
const emit = defineEmits<{
  'update:attachment': [value: AttachmentRef | null]
  rename: [newName: string]
}>()

const { t } = useAppI18n()

const stem = ref('')

const extension = computed<string>(() => (props.attachment === null ? '' : splitFilename(props.attachment.filename).ext))

// Prefill the stem whenever a new row opens the modal (not on every keystroke).
watch(() => props.attachment, (attachment) => {
  if (attachment !== null) stem.value = splitFilename(attachment.filename).stem
})

const newFilename = computed<string>(() => `${stem.value}${extension.value}`)

type RenameError = 'empty' | 'separator' | 'collision' | null

const errorKey = computed<RenameError>(() => {
  if (stem.value.trim() === '') return 'empty'
  if (stem.value.includes('/') || stem.value.includes('\\')) return 'separator'
  if (
    props.attachment !== null &&
    newFilename.value !== props.attachment.filename &&
    props.existingFilenames.includes(newFilename.value)
  ) return 'collision'
  return null
})

const errorMessage = computed<string>(() => {
  if (errorKey.value === 'empty') return t('dialogs.attachments.renameDialog.errorEmpty')
  if (errorKey.value === 'separator') return t('dialogs.attachments.renameDialog.errorSeparator')
  if (errorKey.value === 'collision') return t('dialogs.attachments.renameDialog.errorCollision', { filename: newFilename.value })
  return ''
})

const close = (): void => { emit('update:attachment', null) }

const confirm = (): void => {
  if (errorKey.value !== null) return
  emit('rename', newFilename.value)
}
</script>

<template>
  <Dialog
    :visible="attachment !== null"
    :header="attachment !== null ? t('dialogs.attachments.renameDialog.header', { filename: attachment.filename }) : ''"
    modal
    :style="{ width: '28rem' }"
    data-testid="rename-attachment-dialog"
    @update:visible="(v) => { if (!v) close() }"
  >
    <div v-if="attachment !== null" class="rename-attachment prop-section">
      <label class="prop-field">
        <span>{{ t('dialogs.attachments.renameDialog.newName') }}</span>
        <div class="rename-attachment-name">
          <InputText
            v-model="stem"
            class="rename-attachment-input"
            data-testid="rename-attachment-stem"
            @keyup.enter="confirm"
          />
          <span class="rename-attachment-ext">{{ extension }}</span>
        </div>
      </label>

      <small v-if="errorKey !== null" class="prop-issue" data-testid="rename-attachment-error">
        {{ errorMessage }}
      </small>

      <p class="rename-attachment-refs">
        {{ referenceCount === 0
          ? t('dialogs.attachments.renameDialog.referencesNone')
          : t('dialogs.attachments.renameDialog.referencesCount', { count: referenceCount }, referenceCount) }}
      </p>
    </div>

    <template #footer>
      <Button
        :label="t('dialogs.attachments.renameDialog.cancel')"
        severity="secondary"
        text
        @click="close"
      />
      <Button
        :label="t('dialogs.attachments.renameDialog.confirm')"
        :disabled="errorKey !== null"
        data-testid="rename-attachment-confirm"
        @click="confirm"
      />
    </template>
  </Dialog>
</template>

<style scoped>
@import '../properties/prop-section.css';

.rename-attachment-name {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
}

.rename-attachment-input {
  flex: 1;
}

.rename-attachment-ext {
  color: var(--odk-muted-text-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.rename-attachment-refs {
  margin: 0;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}
</style>
