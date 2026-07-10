<script setup lang="ts">
import Button from 'primevue/button'
import { useRouter } from 'vue-router'

import SaveIndicator from '@/components/shell/SaveIndicator.vue'
import UndoRedoButtons from '@/components/shell/UndoRedoButtons.vue'
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'
import { useEmbedStore } from '@/stores/embed'
import { useFormStore } from '@/stores/form'

const form = useFormStore()
const editor = useEditorStore()
// Embed mode has no library to go back to — the host owns form storage.
const embed = useEmbedStore()
const router = useRouter()
const { t } = useAppI18n()

const backToLibrary = async (): Promise<void> => {
  await form.close()
  await router.push({ name: 'library' })
}
</script>

<template>
  <header class="app-header">
    <div class="app-header-left">
      <Button
        v-if="!embed.active"
        v-tooltip.bottom="t('shell.nav.backToForms')"
        icon="pi pi-arrow-left"
        severity="secondary"
        text
        :aria-label="t('shell.nav.backToForms')"
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
      <Button
        v-tooltip.bottom="t('help.ui.openHelp')"
        icon="pi pi-question-circle"
        severity="secondary"
        text
        :aria-label="t('help.ui.openHelp')"
        data-testid="help-button"
        @click="editor.activeDialog = 'help-reference'"
      />
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

.app-header-left {
  flex: 1 1 auto;
}

.app-header-right {
  flex-shrink: 0;
}

.app-header-left > :deep(.save-indicator),
.app-header-left > :deep([data-testid='save-indicator']) {
  flex-shrink: 0;
  white-space: nowrap;
}

.app-header-title {
  font-size: var(--odk-question-font-size);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 3.75rem;
}
</style>
