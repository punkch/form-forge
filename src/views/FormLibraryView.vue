<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Menu from 'primevue/menu'
import ProgressSpinner from 'primevue/progressspinner'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import ImportDialog from '@/components/importexport/ImportDialog.vue'
import WorkspaceArchiveDialog from '@/components/importexport/WorkspaceArchiveDialog.vue'
import { downloadBlob } from '@/composables/useDownload'
import { buildWorkspaceArchive } from '@/core/workspace/archive'
import { useAppI18n } from '@/i18n'
import type { FormRecord } from '@/persistence/db'
import { gatherArchiveForms } from '@/persistence/workspace-io'
import { useWorkspaceStore } from '@/stores/workspace'

const workspace = useWorkspaceStore()
const router = useRouter()
const confirm = useConfirm()
const toast = useToast()
const { t } = useAppI18n()

onMounted(() => { workspace.startWatching() })

const importVisible = ref(false)
const newFormVisible = ref(false)
const newFormTitle = ref('')
const newFormInput = useTemplateRef<{ $el: HTMLElement } | null>('newFormInput')

const openNewFormDialog = async (): Promise<void> => {
  newFormTitle.value = ''
  newFormVisible.value = true
  await nextTick()
  newFormInput.value?.$el.focus()
}

const createForm = async (): Promise<void> => {
  const title = newFormTitle.value.trim()
  if (title === '') return
  const record = await workspace.createForm(title)
  newFormVisible.value = false
  await router.push({ name: 'editor', params: { formId: record.id } })
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
  { label: t('library.workspace.exportArchive'), icon: 'pi pi-download', command: () => { if (menuRecord.value) void exportFormArchive(menuRecord.value) } },
  { separator: true },
  { label: t('common.delete'), icon: 'pi pi-trash', command: () => { if (menuRecord.value) confirmDelete(menuRecord.value) } },
])

const openMenu = (event: Event, record: FormRecord): void => {
  menuRecord.value = record
  menu.value?.toggle(event)
}

// Workspace archives (.odkbuilder.zip): lossless export/import of whole
// libraries or single forms, incl. attachments (src/core/workspace/archive.ts).
const workspaceImportVisible = ref(false)
const workspaceMenu = useTemplateRef<InstanceType<typeof Menu>>('workspaceMenu')

const appVersion = (): string =>
  typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '2.0.0-dev'

const exportArchive = async (recordIds: string[] | undefined, filename: string): Promise<void> => {
  const forms = await gatherArchiveForms(recordIds)
  const data = await buildWorkspaceArchive(forms, appVersion(), new Date().toISOString())
  downloadBlob(data, filename, 'application/zip')
}

/** yyyy-mm-dd from local date parts, so a filename dated in the user's evening
 * doesn't jump to the next day the way toISOString()'s UTC would. */
const localDateStamp = (date: Date): string => {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const exportWorkspace = (): Promise<void> =>
  exportArchive(undefined, `odkbuilder-workspace-${localDateStamp(new Date())}.odkbuilder.zip`)

const exportFormArchive = (record: FormRecord): Promise<void> =>
  exportArchive([record.id], `${record.formId || 'form'}.odkbuilder.zip`)

const workspaceMenuItems = computed(() => [
  {
    label: t('library.workspace.exportWorkspace'),
    icon: 'pi pi-download',
    disabled: workspace.forms.length === 0,
    command: () => { void exportWorkspace() },
  },
  { label: t('library.workspace.importWorkspace'), icon: 'pi pi-upload', command: () => { workspaceImportVisible.value = true } },
])

const openWorkspaceMenu = (event: Event): void => {
  workspaceMenu.value?.toggle(event)
}

const formatDate = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
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
          icon="pi pi-ellipsis-v"
          severity="secondary"
          text
          rounded
          :aria-label="t('library.workspace.menuLabel')"
          data-testid="library-overflow-menu"
          @click="openWorkspaceMenu"
        />
        <Menu ref="workspaceMenu" :model="workspaceMenuItems" popup />
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
              <code>{{ record.formId }}</code>
              <span>{{ t('library.card.separator') }}</span>
              <span>{{ t('library.card.version', { version: record.version }) }}</span>
              <span>{{ t('library.card.separator') }}</span>
              <span>{{ t('library.card.questionCount', { count: record.questionCount }, record.questionCount) }}</span>
            </span>
          </button>
          <span class="form-card-updated">{{ formatDate(record.updatedAt) }}</span>
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

    <Dialog
      v-model:visible="newFormVisible"
      :header="t('library.newFormDialog.header')"
      modal
      :style="{ width: '28rem' }"
    >
      <label class="dialog-field">
        <span>{{ t('library.newFormDialog.formTitle') }}</span>
        <InputText
          ref="newFormInput"
          v-model="newFormTitle"
          :placeholder="t('library.newFormDialog.placeholder')"
          data-testid="new-form-title"
          @keyup.enter="createForm"
        />
      </label>
      <template #footer>
        <Button :label="t('common.cancel')" severity="secondary" text @click="newFormVisible = false" />
        <Button
          :label="t('library.newFormDialog.create')"
          :disabled="newFormTitle.trim() === ''"
          data-testid="new-form-create"
          @click="createForm"
        />
      </template>
    </Dialog>

    <ImportDialog v-model:visible="importVisible" />

    <WorkspaceArchiveDialog v-model:visible="workspaceImportVisible" />

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
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
  background: none;
  border: none;
  padding: 0;
  text-align: start;
  cursor: pointer;
  font-family: inherit;
}

.form-card-title {
  font-size: var(--odk-question-font-size);
  font-weight: 500;
  color: var(--odk-text-color);
}

.form-card-meta {
  display: flex;
  gap: var(--odk-spacing-s);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.form-card-updated {
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
  white-space: nowrap;
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
</style>
