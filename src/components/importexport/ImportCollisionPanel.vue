<script setup lang="ts">
/**
 * Shared formId-collision prompt: Copy (create a second form) vs Replace
 * (danger — overwrites the existing record in place, keeping its id). Purely
 * presentational — the host owns collision detection, the danger confirm,
 * and the actual landing calls; this only renders the message + two buttons
 * and emits which one was picked. Shared by the library's Central import
 * drawer (`LibraryCentralDrawer`) and the generic Import dialog's ZIP-bundle
 * path (`ImportDialog`), each with its own i18n copy and testid prefix.
 */
import Button from 'primevue/button'

defineProps<{
  message: string
  copyLabel: string
  replaceLabel: string
  /** Disables interaction and shows a spinner while a landing write is in flight. */
  landing: boolean
  /** Root + button testids: `${testidPrefix}`, `${testidPrefix}-copy`, `${testidPrefix}-replace`. */
  testidPrefix: string
}>()

defineEmits<{ copy: [], replace: [] }>()
</script>

<template>
  <div class="import-collision" :data-testid="testidPrefix">
    <p class="import-collision-message">{{ message }}</p>
    <div class="import-collision-actions">
      <Button
        :label="copyLabel"
        severity="secondary"
        :loading="landing"
        :data-testid="`${testidPrefix}-copy`"
        @click="$emit('copy')"
      />
      <Button
        :label="replaceLabel"
        severity="danger"
        :loading="landing"
        :data-testid="`${testidPrefix}-replace`"
        @click="$emit('replace')"
      />
    </div>
  </div>
</template>

<style scoped>
.import-collision {
  margin-top: var(--odk-spacing-m);
  padding-top: var(--odk-spacing-m);
  border-top: 1px solid var(--odk-border-color);
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.import-collision-message {
  margin: 0;
  font-size: var(--odk-hint-font-size);
}

.import-collision-actions {
  display: flex;
  gap: var(--odk-spacing-s);
  justify-content: flex-end;
}
</style>
