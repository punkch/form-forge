<script setup lang="ts">
import { useAppI18n } from '@/i18n'

const { t } = useAppI18n()
</script>

<template>
  <div class="embed-waiting" data-testid="embed-waiting">
    <i class="pi pi-spin pi-spinner embed-waiting-spinner" aria-hidden="true" />
    <p class="embed-waiting-text" role="status">{{ t('shell.embed.waiting') }}</p>
  </div>
</template>

<style scoped>
.embed-waiting {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--odk-spacing-m);
  color: var(--odk-muted-text-color);
  background: var(--builder-canvas-bg);
}

.embed-waiting-spinner {
  font-size: 2rem;
}

.embed-waiting-text {
  margin: 0;
  font-size: var(--odk-question-font-size);
}
</style>
