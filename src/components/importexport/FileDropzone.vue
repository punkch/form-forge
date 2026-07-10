<script setup lang="ts">
import Button from 'primevue/button'
import { useTemplateRef } from 'vue'

import { useFilePick } from '@/composables/useFilePick'

defineProps<{
  /** `accept` attribute for the file input, e.g. '.zip'. */
  accept: string
  /** PrimeIcon class for the dropzone glyph. */
  icon: string
  /** Drop-target instruction text. */
  hint: string
  /** Label for the file-picker button. */
  chooseLabel: string
  /** Shows the picker button's spinner while a file is being read. */
  loading?: boolean
  dropTestid: string
  pickTestid: string
  inputTestid: string
}>()

const emit = defineEmits<{ file: [file: File] }>()

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const openPicker = (): void => { fileInput.value?.click() }
const { dragOver, onPick, onDrop } = useFilePick((file) => { emit('file', file) })
</script>

<template>
  <div
    class="file-dropzone"
    :class="{ over: dragOver }"
    :data-testid="dropTestid"
    @dragover.prevent="dragOver = true"
    @dragleave="dragOver = false"
    @drop.prevent="onDrop"
  >
    <i :class="icon" />
    <p>{{ hint }}</p>
    <Button
      :label="chooseLabel"
      severity="secondary"
      :loading="loading"
      :data-testid="pickTestid"
      @click="openPicker"
    />
    <input
      ref="fileInput"
      type="file"
      :accept="accept"
      class="file-dropzone-input"
      :data-testid="inputTestid"
      @change="onPick"
    >
  </div>
</template>

<style scoped>
.file-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--odk-spacing-m);
  padding: var(--odk-spacing-xxl);
  border: 2px dashed var(--odk-border-color);
  border-radius: var(--odk-radius);
  color: var(--odk-muted-text-color);
  text-align: center;
}

.file-dropzone.over {
  border-color: var(--odk-primary-border-color);
  background: var(--odk-primary-lighter-background-color);
}

.file-dropzone i {
  font-size: 2rem;
}

.file-dropzone-input {
  display: none;
}
</style>
