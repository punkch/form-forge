<script setup lang="ts">
import Button from 'primevue/button'

import { useFormStore } from '@/stores/form'

const form = useFormStore()
</script>

<template>
  <span class="undo-redo">
    <Button
      v-tooltip.bottom="form.undoLabel ? `Undo: ${form.undoLabel}` : 'Undo'"
      icon="pi pi-undo"
      severity="secondary"
      text
      :disabled="!form.canUndo"
      aria-label="Undo"
      data-testid="undo"
      @click="form.undo()"
    />
    <Button
      v-tooltip.bottom="'Redo'"
      icon="pi pi-refresh"
      severity="secondary"
      text
      :disabled="!form.canRedo"
      aria-label="Redo"
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
