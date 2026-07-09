<script setup lang="ts">
import Button from 'primevue/button'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { useFormStore } from '@/stores/form'
import { usePreviewStore } from '@/stores/preview'

const form = useFormStore()
const preview = usePreviewStore()
const router = useRouter()

const detailsOpen = ref(false)

const openFullPreview = (): void => {
  if (form.recordId !== null) {
    void router.push({ name: 'preview', params: { formId: form.recordId } })
  }
}
</script>

<template>
  <div class="preview-error-state" data-testid="preview-error-state">
    <i class="pi pi-exclamation-triangle" />
    <p class="error-heading">The preview couldn't load this version of the form.</p>
    <button
      type="button"
      class="details-toggle"
      :aria-expanded="detailsOpen"
      @click="detailsOpen = !detailsOpen"
    >
      <i :class="detailsOpen ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" />
      {{ detailsOpen ? 'Hide details' : 'Show details' }}
    </button>
    <pre v-if="detailsOpen" class="error-details">{{ preview.engineError }}</pre>
    <span class="error-actions">
      <Button
        icon="pi pi-refresh"
        label="Retry"
        severity="secondary"
        outlined
        size="small"
        data-testid="preview-error-retry"
        @click="preview.refreshNow()"
      />
      <Button
        icon="pi pi-window-maximize"
        label="Open full-page preview"
        severity="secondary"
        text
        size="small"
        @click="openFullPreview"
      />
    </span>
  </div>
</template>

<style scoped>
.preview-error-state {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--odk-spacing-m);
  padding: var(--odk-spacing-xl);
  text-align: center;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.preview-error-state > .pi-exclamation-triangle {
  font-size: 2rem;
  color: var(--odk-warning-text-color);
}

.error-heading {
  margin: 0;
  color: var(--odk-text-color);
  font-weight: 500;
}

.details-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--odk-muted-text-color);
  font-family: inherit;
  font-size: var(--odk-hint-font-size);
  cursor: pointer;
}

.details-toggle:hover {
  color: var(--odk-text-color);
}

.error-details {
  max-width: 100%;
  max-height: 30vh;
  overflow: auto;
  margin: 0;
  padding: var(--odk-spacing-s) var(--odk-spacing-m);
  border-radius: var(--odk-radius);
  background: var(--odk-muted-background-color);
  color: var(--odk-text-color);
  font-size: var(--odk-hint-font-size);
  text-align: left;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.error-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  flex-wrap: wrap;
  justify-content: center;
}
</style>
