<script setup lang="ts">
import { computed } from 'vue'

import { useAppI18n } from '@/i18n'
import type { SaveState } from '@/stores/form'

const props = defineProps<{ state: SaveState }>()

const { t } = useAppI18n()

const display = computed(() => {
  switch (props.state) {
    case 'saving': return { icon: 'pi pi-spin pi-spinner', text: t('shell.save.saving'), cls: 'saving' }
    case 'dirty': return { icon: 'pi pi-circle-fill', text: t('shell.save.dirty'), cls: 'dirty' }
    case 'error': return { icon: 'pi pi-exclamation-circle', text: t('shell.save.error'), cls: 'error' }
    default: return { icon: 'pi pi-check-circle', text: t('shell.save.saved'), cls: 'saved' }
  }
})
</script>

<template>
  <span class="save-indicator" :class="display.cls" role="status" aria-live="polite" data-testid="save-indicator">
    <i :class="display.icon" />
    <span>{{ display.text }}</span>
  </span>
</template>

<style scoped>
.save-indicator {
  display: inline-flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.save-indicator.dirty i {
  color: var(--odk-warning-text-color);
  font-size: 8px;
}

.save-indicator.saved i {
  color: var(--odk-success-text-color);
}

.save-indicator.error {
  color: var(--odk-error-text-color);
}
</style>
