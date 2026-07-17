<script setup lang="ts">
// Dumb single-slot attachment picker: the parent owns every mutation (like
// LocalizedInput), this component only reads doc.attachments to build the
// Select's option list and renders the current filename/status/upload
// affordance. Shared by label-media rows (BasicSection/LabelMediaSection),
// choice media rows (ChoicesSection) and the image question's default-image
// slot.
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, useTemplateRef } from 'vue'

import type { MediaSlot } from '@/core/model/translations'
import { useAppI18n } from '@/i18n'
import { useFormStore } from '@/stores/form'

const props = defineProps<{
  /** Bare filename shared by every current language, or null when unset. */
  filename: string | null
  kind: MediaSlot
  /** Filename is set but names no attachment in doc.attachments. */
  missing: boolean
  /** Set values diverge across the document's current languages. */
  varies: boolean
  /** Root data-testid; derived testids append -select/-status/-upload/etc. */
  testidPrefix: string
}>()

const emit = defineEmits<{ pick: [filename: string | null], upload: [file: File] }>()

const { t } = useAppI18n()
const form = useFormStore()
const uploadInput = useTemplateRef<HTMLInputElement>('uploadInput')

const MEDIATYPE_PREFIX: Record<MediaSlot, string> = {
  image: 'image/', bigImage: 'image/', audio: 'audio/', video: 'video/',
}

const ACCEPT: Record<MediaSlot, string> = {
  image: 'image/*', bigImage: 'image/*', audio: 'audio/*', video: 'video/*',
}

const selectOptions = computed(() => {
  const prefix = MEDIATYPE_PREFIX[props.kind]
  const options = (form.doc?.attachments ?? [])
    .filter((a) => a.mediatype.startsWith(prefix))
    .map((a) => ({ label: a.filename, value: a.filename }))
  // A previously-picked filename with no matching attachment (deleted /
  // renamed away, or simply not uploaded yet) still needs to show as the
  // Select's current value.
  if (props.filename !== null && !options.some((o) => o.value === props.filename)) {
    options.push({ label: props.filename, value: props.filename })
  }
  return options
})

const onPick = (value: string | null): void => { emit('pick', value) }

const onFileChange = (event: Event): void => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file !== undefined) emit('upload', file)
}
</script>

<template>
  <div class="attachment-picker" :data-testid="testidPrefix">
    <div class="attachment-picker-row">
      <Select
        :model-value="filename"
        :options="selectOptions"
        option-label="label"
        option-value="value"
        show-clear
        :placeholder="t('properties.media.pickerPlaceholder')"
        class="attachment-picker-select"
        :data-testid="`${testidPrefix}-select`"
        @update:model-value="onPick"
      />
      <Button
        :label="filename !== null ? t('properties.media.pickerReplace') : t('properties.media.pickerUpload')"
        icon="pi pi-upload"
        size="small"
        severity="secondary"
        outlined
        :data-testid="`${testidPrefix}-upload`"
        @click="uploadInput?.click()"
      />
    </div>

    <p v-if="varies" class="attachment-picker-varies" :data-testid="`${testidPrefix}-varies`">
      {{ t('properties.media.pickerVaries') }}
    </p>
    <div
      v-else-if="filename !== null"
      class="attachment-picker-status"
      :class="missing ? 'attachment-picker-missing' : 'attachment-picker-attached'"
      :data-state="missing ? 'missing' : 'attached'"
      :data-testid="`${testidPrefix}-status`"
    >
      <i :class="missing ? 'pi pi-exclamation-triangle' : 'pi pi-check-circle'" />
      <span>{{ missing ? t('properties.media.pickerMissing', { filename }) : t('properties.media.pickerAttached', { filename }) }}</span>
    </div>

    <input
      ref="uploadInput"
      type="file"
      :accept="ACCEPT[kind]"
      class="attachment-picker-upload-input"
      :data-testid="`${testidPrefix}-upload-input`"
      @change="onFileChange"
    >
  </div>
</template>

<style scoped>
@import './prop-section.css';

.attachment-picker {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.attachment-picker-row {
  display: flex;
  gap: var(--odk-spacing-s);
}

.attachment-picker-select {
  flex: 1;
  min-width: 0;
}

.attachment-picker-status {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  font-size: var(--odk-hint-font-size);
}

.attachment-picker-attached {
  color: var(--odk-success-text-color);
}

.attachment-picker-missing {
  color: var(--odk-warning-text-color);
}

.attachment-picker-varies {
  margin: 0;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
  font-style: italic;
}

.attachment-picker-upload-input {
  display: none;
}
</style>
