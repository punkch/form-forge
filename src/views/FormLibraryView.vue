<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Menu from 'primevue/menu'
import ProgressSpinner from 'primevue/progressspinner'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { computed, defineAsyncComponent, onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import ImportDialog from '@/components/importexport/ImportDialog.vue'
import NewFormDialog from '@/components/library/NewFormDialog.vue'
import { useStoragePersistence } from '@/composables/useStoragePersistence'
import { useWorkspaceExport } from '@/composables/useWorkspaceExport'
import { formatVersion, languageCodes } from '@/core/model/library-display'
import { useAppI18n } from '@/i18n'
import type { FormRecord } from '@/persistence/db'
import * as templatesRepo from '@/persistence/templates-repo'
import { useEditorStore } from '@/stores/editor'
import { useUiStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import { appVersion } from '@/version'

// The help drawer is only reachable from the toolbar "?"; loading it lazily
// keeps the question-type registry and help graph out of the landing chunk.
const QuestionTypeHelpDrawer = defineAsyncComponent(
  () => import('@/components/help/QuestionTypeHelpDrawer.vue')
)

const workspace = useWorkspaceStore()
const ui = useUiStore()
const editor = useEditorStore()
const router = useRouter()
const confirm = useConfirm()
const toast = useToast()
const { t } = useAppI18n()
const { exportWorkspace, exportFormArchive } = useWorkspaceExport()

// Durable-storage status for the footer: granted after the first save
// (src/pwa/persistentStorage.ts); null hides both footer states (API absent).
const storagePersistent = useStoragePersistence()

onMounted(() => {
  workspace.startWatching()
})

const importVisible = ref(false)
const newFormVisible = ref(false)

const openNewFormDialog = (): void => {
  newFormVisible.value = true
}

const onFormCreated = (record: FormRecord): void => {
  void router.push({ name: 'editor', params: { formId: record.id } })
}

const openForm = (record: FormRecord): void => {
  void router.push({ name: 'editor', params: { formId: record.id } })
}

// Rename dialog
const renameVisible = ref(false)
const renameTitle = ref('')
const renameTarget = ref<FormRecord | null>(null)

const startRename = (record: FormRecord): void => {
  renameTarget.value = record
  renameTitle.value = record.title
  renameVisible.value = true
}

const applyRename = async (): Promise<void> => {
  const title = renameTitle.value.trim()
  if (renameTarget.value === null || title === '') return
  await workspace.renameForm(renameTarget.value.id, title)
  renameVisible.value = false
}

const duplicateForm = async (record: FormRecord): Promise<void> => {
  const copy = await workspace.duplicateForm(record.id)
  if (copy !== undefined) {
    toast.add({ severity: 'success', summary: t('library.toast.duplicated'), detail: copy.title, life: 2500 })
  }
}

// Save-as-template dialog
const saveTemplateVisible = ref(false)
const saveTemplateName = ref('')
const saveTemplateDescription = ref('')
const saveTemplateTarget = ref<FormRecord | null>(null)

const startSaveTemplate = (record: FormRecord): void => {
  saveTemplateTarget.value = record
  saveTemplateName.value = record.title
  saveTemplateDescription.value = ''
  saveTemplateVisible.value = true
}

const applySaveTemplate = async (): Promise<void> => {
  const name = saveTemplateName.value.trim()
  const target = saveTemplateTarget.value
  if (target === null || name === '') return
  await templatesRepo.addTemplate(target.doc, name, saveTemplateDescription.value.trim())
  saveTemplateVisible.value = false
  toast.add({ severity: 'success', summary: t('library.toast.templateSaved'), detail: name, life: 2500 })
}

const confirmDelete = (record: FormRecord): void => {
  confirm.require({
    header: t('library.deleteConfirm.header'),
    message: t('library.deleteConfirm.message', { title: record.title }),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('common.delete'),
    rejectLabel: t('common.cancel'),
    acceptProps: { severity: 'danger' },
    accept: () => { void workspace.deleteForm(record.id) },
  })
}

// Row actions menu
const menu = useTemplateRef<InstanceType<typeof Menu>>('menu')
const menuRecord = ref<FormRecord | null>(null)
const menuItems = computed(() => [
  { label: t('library.menu.rename'), icon: 'pi pi-pencil', command: () => { if (menuRecord.value) startRename(menuRecord.value) } },
  { label: t('library.menu.duplicate'), icon: 'pi pi-copy', command: () => { if (menuRecord.value) void duplicateForm(menuRecord.value) } },
  { label: t('library.menu.saveTemplate'), icon: 'pi pi-bookmark', command: () => { if (menuRecord.value) startSaveTemplate(menuRecord.value) } },
  { label: t('library.workspace.exportArchive'), icon: 'pi pi-download', command: () => { if (menuRecord.value) void exportFormArchive(menuRecord.value) } },
  { separator: true },
  { label: t('common.delete'), icon: 'pi pi-trash', command: () => { if (menuRecord.value) confirmDelete(menuRecord.value) } },
])

const openMenu = (event: Event, record: FormRecord): void => {
  menuRecord.value = record
  menu.value?.toggle(event)
}

const formatDate = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** "EN · FR" from the doc's declared languages; '' hides the badge. */
const languageBadge = (record: FormRecord): string =>
  languageCodes(record.doc.languages).join(` ${t('library.card.separator')} `)
</script>

<template>
  <div class="library">
    <header class="library-header">
      <div class="library-title">
        <h1>{{ t('library.header.title') }}</h1>
        <p class="library-subtitle">
          {{ t('library.header.subtitle') }}
        </p>
      </div>
      <div class="library-actions">
        <Button
          :label="t('library.header.importForm')"
          icon="pi pi-upload"
          severity="secondary"
          data-testid="import-form"
          @click="importVisible = true"
        />
        <Button
          :label="t('library.header.newForm')"
          icon="pi pi-plus"
          data-testid="new-form"
          @click="openNewFormDialog"
        />
        <Button
          icon="pi pi-question-circle"
          severity="secondary"
          text
          rounded
          :aria-label="t('guides.ui.libraryHelp')"
          :title="t('guides.ui.libraryHelp')"
          data-testid="library-help"
          @click="editor.activeDialog = 'help-reference'"
        />
        <Button
          icon="pi pi-cog"
          severity="secondary"
          text
          rounded
          :aria-label="t('appSettings.open')"
          data-testid="settings-gear"
          @click="router.push({ name: 'settings' })"
        />
      </div>
    </header>

    <main class="library-main">
      <div v-if="workspace.loading" class="library-empty">
        <ProgressSpinner style="width: 40px; height: 40px" />
      </div>

      <div v-else-if="workspace.forms.length === 0" class="library-empty" data-testid="library-empty">
        <i class="pi pi-file-edit empty-icon" />
        <h2>{{ t('library.empty.title') }}</h2>
        <p>{{ t('library.empty.hint') }}</p>
        <Button :label="t('library.header.newForm')" icon="pi pi-plus" @click="openNewFormDialog" />
      </div>

      <ul v-else class="form-list" data-testid="form-list">
        <li
          v-for="record in workspace.forms"
          :key="record.id"
          class="form-card"
          :data-testid="`form-card-${record.formId}`"
        >
          <button class="form-card-main" @click="openForm(record)">
            <span class="form-card-title">{{ record.title }}</span>
            <span class="form-card-meta">
              <span class="meta-chip">
                <i class="pi pi-list" aria-hidden="true" />
                {{ t('library.card.questionCount', { count: record.questionCount }, record.questionCount) }}
              </span>
              <span
                v-if="languageBadge(record) !== ''"
                class="meta-chip"
                :title="t('library.card.languagesTitle', { languages: record.doc.languages.join(', ') })"
                data-testid="form-card-languages"
              >
                <i class="pi pi-language" aria-hidden="true" />
                {{ languageBadge(record) }}
              </span>
              <code class="meta-form-id">{{ record.formId }}</code>
              <span class="meta-version">{{ t('library.card.version', { version: formatVersion(record.version) }) }}</span>
            </span>
          </button>
          <span class="form-card-updated">
            <i class="pi pi-clock" aria-hidden="true" />
            {{ t('library.card.updated', { date: formatDate(record.updatedAt) }) }}
          </span>
          <Button
            icon="pi pi-ellipsis-v"
            severity="secondary"
            text
            rounded
            :aria-label="t('library.card.actionsFor', { title: record.title })"
            data-testid="form-card-menu"
            @click="openMenu($event, record)"
          />
        </li>
      </ul>
      <Menu ref="menu" :model="menuItems" popup />
    </main>

    <footer class="library-footer" data-testid="library-footer">
      <span class="footer-version">{{ t('library.footer.version', { version: appVersion() }) }}</span>
      <span
        v-if="storagePersistent === true"
        class="footer-storage"
        data-testid="storage-persistent"
      >
        <i class="pi pi-check-circle" />
        {{ t('library.footer.storagePersistent') }}
      </span>
      <span
        v-else-if="storagePersistent === false && !ui.storageHintDismissed"
        class="footer-storage"
        data-testid="storage-hint"
      >
        <i class="pi pi-info-circle" />
        {{ t('library.footer.storageHint') }}
        <a href="#" class="footer-storage-link" @click.prevent="exportWorkspace()">
          {{ t('library.footer.storageHintAction') }}</a>
        <Button
          icon="pi pi-times"
          severity="secondary"
          text
          rounded
          size="small"
          :aria-label="t('library.footer.storageHintDismiss')"
          data-testid="storage-hint-dismiss"
          @click="ui.dismissStorageHint"
        />
      </span>
    </footer>

    <NewFormDialog v-model:visible="newFormVisible" @created="onFormCreated" />

    <Dialog
      v-model:visible="saveTemplateVisible"
      :header="t('library.saveTemplateDialog.header')"
      modal
      :style="{ width: '28rem' }"
    >
      <div class="dialog-fields">
        <label class="dialog-field">
          <span>{{ t('library.saveTemplateDialog.name') }}</span>
          <InputText v-model="saveTemplateName" data-testid="save-template-name" @keyup.enter="applySaveTemplate" />
        </label>
        <label class="dialog-field">
          <span>{{ t('library.saveTemplateDialog.description') }}</span>
          <InputText v-model="saveTemplateDescription" data-testid="save-template-description" @keyup.enter="applySaveTemplate" />
        </label>
        <p class="dialog-note">{{ t('library.saveTemplateDialog.note') }}</p>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" severity="secondary" text @click="saveTemplateVisible = false" />
        <Button
          :label="t('library.saveTemplateDialog.save')"
          :disabled="saveTemplateName.trim() === ''"
          data-testid="save-template-confirm"
          @click="applySaveTemplate"
        />
      </template>
    </Dialog>

    <ImportDialog v-model:visible="importVisible" />

    <Dialog
      v-model:visible="renameVisible"
      :header="t('library.renameDialog.header')"
      modal
      :style="{ width: '28rem' }"
    >
      <label class="dialog-field">
        <span>{{ t('library.renameDialog.formTitle') }}</span>
        <InputText v-model="renameTitle" data-testid="rename-title" @keyup.enter="applyRename" />
      </label>
      <template #footer>
        <Button :label="t('common.cancel')" severity="secondary" text @click="renameVisible = false" />
        <Button :label="t('library.renameDialog.rename')" :disabled="renameTitle.trim() === ''" @click="applyRename" />
      </template>
    </Dialog>

    <!-- The help drawer normally mounts via EditorDialogs (editor route only);
         the library "?" needs its own mount here. Both are driven by the global
         editor store and the two routes never coexist, so the second mount
         point is safe. The v-if keeps the lazy chunk (and its question-type /
         help graph) out of the landing route until the drawer is opened. -->
    <QuestionTypeHelpDrawer v-if="editor.activeDialog === 'help-reference'" />
  </div>
</template>

<style scoped>
.library {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: var(--odk-max-form-width);
  width: 100%;
  margin: 0 auto;
  padding: var(--odk-spacing-xxl) var(--odk-spacing-xl);
  overflow-y: auto;
  min-height: 0;
}

.library-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--odk-spacing-l);
  margin-bottom: var(--odk-spacing-xxl);
}

.library-title h1 {
  margin: 0;
  font-size: var(--odk-heading-font-size);
}

.library-subtitle {
  margin: var(--odk-spacing-s) 0 0;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.library-actions {
  display: flex;
  gap: var(--odk-spacing-m);
  flex-shrink: 0;
}

.library-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--odk-spacing-m);
  padding: var(--odk-spacing-xxl);
  text-align: center;
  color: var(--odk-muted-text-color);
}

.empty-icon {
  font-size: 3rem;
  color: var(--odk-light-muted-text-color);
}

.form-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
}

.form-card {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-l);
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
  background: var(--odk-base-background-color);
  padding: var(--odk-spacing-l);
}

.form-card:hover {
  border-color: var(--odk-primary-border-color);
}

.form-card-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
  background: none;
  border: none;
  padding: 0;
  text-align: start;
  cursor: pointer;
  font-family: inherit;
}

.form-card-title {
  font-size: var(--odk-question-font-size);
  font-weight: 600;
  color: var(--odk-text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-card-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--odk-spacing-s) var(--odk-spacing-m);
  font-size: var(--odk-hint-font-size);
}

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  padding: 2px var(--odk-spacing-m);
  border: 1px solid var(--odk-border-color);
  border-radius: 999px;
  background: var(--odk-light-background-color);
  color: var(--odk-text-color);
}

.meta-chip .pi {
  font-size: var(--odk-icon-s);
  color: var(--odk-muted-text-color);
}

.meta-form-id {
  color: var(--odk-muted-text-color);
}

.meta-version {
  color: var(--odk-light-muted-text-color);
}

.form-card-updated {
  display: inline-flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  color: var(--odk-text-color);
  font-size: var(--odk-hint-font-size);
  white-space: nowrap;
}

.form-card-updated .pi {
  font-size: var(--odk-icon-s);
  color: var(--odk-muted-text-color);
}

.dialog-fields {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
}

.dialog-field {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.dialog-field > span {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.dialog-note {
  margin: 0;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.library-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--odk-spacing-l);
  margin-top: var(--odk-spacing-xxl);
  padding-top: var(--odk-spacing-l);
  border-top: 1px solid var(--odk-border-color);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.footer-storage {
  display: inline-flex;
  align-items: center;
  gap: var(--odk-spacing-s);
}

.footer-storage-link {
  color: var(--odk-primary-text-color);
}
</style>
