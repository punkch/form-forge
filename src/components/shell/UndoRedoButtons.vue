<script setup lang="ts">
import Button from 'primevue/button'

import { useAppI18n } from '@/i18n'
import { useFormStore } from '@/stores/form'

const form = useFormStore()
const { t } = useAppI18n()
</script>

<template>
  <span class="undo-redo">
    <Button
      v-tooltip.bottom="form.undoLabel ? t('shell.undoRedo.undoWithLabel', { label: form.undoLabel }) : t('shell.undoRedo.undo')"
      icon="pi pi-undo"
      severity="secondary"
      text
      :disabled="!form.canUndo"
      :aria-label="t('shell.undoRedo.undo')"
      data-testid="undo"
      @click="form.undo()"
    />
    <Button
      v-tooltip.bottom="t('shell.undoRedo.redo')"
      icon="pi pi-refresh"
      severity="secondary"
      text
      :disabled="!form.canRedo"
      :aria-label="t('shell.undoRedo.redo')"
      data-testid="redo"
      @click="form.redo()"
    />
  </span>
</template>

<style scoped>
.undo-redo {
  display: inline-flex;
  gap: 2px;
}
</style>
