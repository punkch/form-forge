<script setup lang="ts">
import Button from 'primevue/button'
import { useRouter } from 'vue-router'

import { useAppI18n } from '@/i18n'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ formId: string }>()

const form = useFormStore()
const router = useRouter()
const { t } = useAppI18n()

const openPreview = (): void => {
  void router.push({ name: 'preview', params: { formId: props.formId } })
}

const backToLibrary = async (): Promise<void> => {
  await form.close()
  await router.push({ name: 'library' })
}
</script>

<template>
  <div class="blocked-editor" data-testid="editor-blocked">
    <i class="pi pi-arrows-alt blocked-icon" />
    <h2>{{ form.doc?.settings.formTitle ?? t('shell.blocked.thisForm') }}</h2>
    <p class="blocked-copy">
      {{ t('shell.blocked.copy') }}
    </p>
    <div class="blocked-actions">
      <Button
        :label="t('shell.blocked.openPreview')"
        icon="pi pi-eye"
        data-testid="blocked-open-preview"
        @click="openPreview"
      />
      <Button
        :label="t('shell.nav.backToForms')"
        icon="pi pi-arrow-left"
        severity="secondary"
        @click="backToLibrary"
      />
    </div>
  </div>
</template>

<style scoped>
.blocked-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--odk-spacing-l);
  padding: var(--odk-spacing-xxl);
  text-align: center;
  background: var(--builder-canvas-bg);
}

.blocked-icon {
  font-size: 2.5rem;
  color: var(--odk-light-muted-text-color);
}

.blocked-editor h2 {
  margin: 0;
}

.blocked-copy {
  margin: 0;
  max-width: 26rem;
  color: var(--odk-muted-text-color);
}

.blocked-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--odk-spacing-m);
  margin-top: var(--odk-spacing-m);
}
</style>
