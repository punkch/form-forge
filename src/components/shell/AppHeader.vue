<script setup lang="ts">
import Button from 'primevue/button'
import { useRouter } from 'vue-router'

import SaveIndicator from '@/components/shell/SaveIndicator.vue'
import UndoRedoButtons from '@/components/shell/UndoRedoButtons.vue'
import { useFormStore } from '@/stores/form'

const form = useFormStore()
const router = useRouter()

const backToLibrary = async (): Promise<void> => {
  await form.close()
  await router.push({ name: 'library' })
}
</script>

<template>
  <header class="app-header">
    <div class="app-header-left">
      <Button
        v-tooltip.bottom="'Back to forms'"
        icon="pi pi-arrow-left"
        severity="secondary"
        text
        aria-label="Back to forms"
        data-testid="back-to-library"
        @click="backToLibrary"
      />
      <span class="app-header-title" data-testid="editor-form-title">
        {{ form.doc?.settings.formTitle ?? '' }}
      </span>
      <SaveIndicator :state="form.saveState" />
    </div>
    <div class="app-header-right">
      <UndoRedoButtons />
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: var(--builder-header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--odk-spacing-l);
  padding: 0 var(--odk-spacing-l);
  background: var(--odk-base-background-color);
  border-bottom: var(--builder-panel-border);
  flex-shrink: 0;
}

.app-header-left,
.app-header-right {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
  min-width: 0;
}

.app-header-title {
  font-size: var(--odk-question-font-size);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
