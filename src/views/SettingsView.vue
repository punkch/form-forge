<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import CentralServersSection from '@/components/central/CentralServersSection.vue'
import WorkspaceArchiveDialog from '@/components/importexport/WorkspaceArchiveDialog.vue'
import { useStoragePersistence } from '@/composables/useStoragePersistence'
import { useWorkspaceExport } from '@/composables/useWorkspaceExport'
import { localeOptions, useAppI18n } from '@/i18n'
import { setLocale } from '@/i18n/setLocale'
import { useUiStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import { appVersion } from '@/version'

const router = useRouter()
const { t } = useAppI18n()
const ui = useUiStore()
const workspace = useWorkspaceStore()
const { exportWorkspace } = useWorkspaceExport()

// Same durable-storage probe the library footer uses; null (API absent)
// renders the "unavailable" line instead of hiding it.
const storagePersistent = useStoragePersistence()

onMounted(() => {
  // Idempotent — usually already watching from the library, but a direct
  // #/settings navigation still needs the forms list for the export button.
  workspace.startWatching()
})

const backToLibrary = (): void => {
  void router.push({ name: 'library' })
}

// Workspace archive import reuses the library's former dialog wholesale.
const workspaceImportVisible = ref(false)

// Every registered UI catalog; production ships `en` only, tests register
// more via i18n.global.setLocaleMessage (src/i18n/index.ts).
const languages = computed(() => localeOptions())

const changeLocale = (code: string): void => {
  setLocale(code)
  ui.locale = code // the ui store watcher persists it to localStorage
}

const storageText = computed((): string => {
  if (storagePersistent.value === true) return t('appSettings.about.storagePersistent')
  if (storagePersistent.value === false) return t('appSettings.about.storageNotPersistent')
  return t('appSettings.about.storageUnknown')
})
</script>

<template>
  <div class="settings" data-testid="settings-view">
    <header class="settings-bar">
      <Button
        icon="pi pi-arrow-left"
        :label="t('appSettings.back')"
        severity="secondary"
        text
        data-testid="settings-back"
        @click="backToLibrary"
      />
      <h1 class="settings-heading">{{ t('appSettings.title') }}</h1>
    </header>

    <main class="settings-body">
      <section class="settings-section">
        <h2>{{ t('appSettings.workspace.heading') }}</h2>
        <div class="settings-row">
          <p class="settings-note">{{ t('appSettings.workspace.exportDescription') }}</p>
          <Button
            :label="t('appSettings.workspace.exportWorkspace')"
            icon="pi pi-download"
            severity="secondary"
            :disabled="workspace.forms.length === 0"
            data-testid="settings-export-workspace"
            @click="exportWorkspace()"
          />
        </div>
        <div class="settings-row">
          <p class="settings-note">{{ t('appSettings.workspace.importDescription') }}</p>
          <Button
            :label="t('appSettings.workspace.importWorkspace')"
            icon="pi pi-upload"
            severity="secondary"
            data-testid="settings-import-workspace"
            @click="workspaceImportVisible = true"
          />
        </div>
      </section>

      <section class="settings-section">
        <h2>{{ t('appSettings.language.heading') }}</h2>
        <label class="settings-field">
          <span>{{ t('appSettings.language.label') }}</span>
          <Select
            :model-value="ui.locale"
            :options="languages"
            option-label="label"
            option-value="code"
            data-testid="settings-language-select"
            @update:model-value="changeLocale"
          />
        </label>
        <p class="settings-note">{{ t('appSettings.language.appLanguageNote') }}</p>
      </section>

      <section class="settings-section" data-testid="settings-about">
        <h2>{{ t('appSettings.about.heading') }}</h2>
        <p class="settings-line" data-testid="settings-about-version">
          {{ t('appSettings.about.version', { version: appVersion() }) }}
        </p>
        <p class="settings-line" data-testid="settings-about-storage">
          {{ storageText }}
        </p>
        <!-- Extension point: a manual "check for updates" action needs
             useSwUpdate (src/pwa/registerSW.ts) to expose a check — omitted
             deliberately (docs/specs/2026-07-10-2005-settings-page/shape.md). -->
      </section>

      <CentralServersSection />
    </main>

    <WorkspaceArchiveDialog v-model:visible="workspaceImportVisible" />
  </div>
</template>

<style scoped>
.settings {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.settings-bar {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-l);
  padding: var(--odk-spacing-s) var(--odk-spacing-l);
  border-bottom: var(--builder-panel-border);
}

.settings-bar > :deep(.p-button) {
  flex-shrink: 0;
  white-space: nowrap;
}

.settings-heading {
  margin: 0;
  font-size: var(--odk-question-font-size);
  font-weight: 600;
}

.settings-body {
  flex: 1;
  overflow-y: auto;
  width: 100%;
  max-width: 46rem;
  margin: 0 auto;
  padding: var(--odk-spacing-xxl) var(--odk-spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-xl);
}

.settings-section {
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
  background: var(--odk-base-background-color);
  padding: var(--odk-spacing-l) var(--odk-spacing-xl);
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
}

.settings-section h2 {
  margin: 0;
  font-size: var(--odk-question-font-size);
}

.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--odk-spacing-l);
}

.settings-row > :deep(.p-button) {
  flex-shrink: 0;
  white-space: nowrap;
}

.settings-note {
  margin: 0;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.settings-field {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.settings-field > span {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.settings-field :deep(.p-select) {
  width: 16rem;
  max-width: 100%;
}

.settings-line {
  margin: 0;
}
</style>
