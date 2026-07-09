<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Menu from 'primevue/menu'
import ProgressSpinner from 'primevue/progressspinner'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { nextTick, onMounted, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'

import ImportDialog from '@/components/importexport/ImportDialog.vue'
import type { FormRecord } from '@/persistence/db'
import { useWorkspaceStore } from '@/stores/workspace'

const workspace = useWorkspaceStore()
const router = useRouter()
const confirm = useConfirm()
const toast = useToast()

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
    toast.add({ severity: 'success', summary: 'Form duplicated', detail: copy.title, life: 2500 })
  }
}

const confirmDelete = (record: FormRecord): void => {
  confirm.require({
    header: 'Delete form',
    message: `Delete "${record.title}" and its attachments? This cannot be undone.`,
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    acceptProps: { severity: 'danger' },
    accept: () => { void workspace.deleteForm(record.id) },
  })
}

// Row actions menu
const menu = useTemplateRef<InstanceType<typeof Menu>>('menu')
const menuRecord = ref<FormRecord | null>(null)
const menuItems = [
  { label: 'Rename', icon: 'pi pi-pencil', command: () => { if (menuRecord.value) startRename(menuRecord.value) } },
  { label: 'Duplicate', icon: 'pi pi-copy', command: () => { if (menuRecord.value) void duplicateForm(menuRecord.value) } },
  { separator: true },
  { label: 'Delete', icon: 'pi pi-trash', command: () => { if (menuRecord.value) confirmDelete(menuRecord.value) } },
]

const openMenu = (event: Event, record: FormRecord): void => {
  menuRecord.value = record
  menu.value?.toggle(event)
}

const formatDate = (ts: number): string =>
  new Date(ts).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <div class="library">
    <header class="library-header">
      <div class="library-title">
        <h1>ODK Form Builder</h1>
        <p class="library-subtitle">
          Forms are stored in this browser only — nothing leaves your device.
        </p>
      </div>
      <div class="library-actions">
        <Button
          label="Import form"
          icon="pi pi-upload"
          severity="secondary"
          data-testid="import-form"
          @click="importVisible = true"
        />
        <Button
          label="New form"
          icon="pi pi-plus"
          data-testid="new-form"
          @click="openNewFormDialog"
        />
      </div>
    </header>

    <main class="library-main">
      <div v-if="workspace.loading" class="library-empty">
        <ProgressSpinner style="width: 40px; height: 40px" />
      </div>

      <div v-else-if="workspace.forms.length === 0" class="library-empty" data-testid="library-empty">
        <i class="pi pi-file-edit empty-icon" />
        <h2>No forms yet</h2>
        <p>Create a new form to get started.</p>
        <Button label="New form" icon="pi pi-plus" @click="openNewFormDialog" />
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
              <span>·</span>
              <span>v{{ record.version }}</span>
              <span>·</span>
              <span>{{ record.questionCount }} question{{ record.questionCount === 1 ? '' : 's' }}</span>
            </span>
          </button>
          <span class="form-card-updated">{{ formatDate(record.updatedAt) }}</span>
          <Button
            icon="pi pi-ellipsis-v"
            severity="secondary"
            text
            rounded
            :aria-label="`Actions for ${record.title}`"
            data-testid="form-card-menu"
            @click="openMenu($event, record)"
          />
        </li>
      </ul>
      <Menu ref="menu" :model="menuItems" popup />
    </main>

    <Dialog
      v-model:visible="newFormVisible"
      header="New form"
      modal
      :style="{ width: '28rem' }"
    >
      <label class="dialog-field">
        <span>Form title</span>
        <InputText
          ref="newFormInput"
          v-model="newFormTitle"
          placeholder="e.g. Household Survey"
          data-testid="new-form-title"
          @keyup.enter="createForm"
        />
      </label>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="newFormVisible = false" />
        <Button
          label="Create"
          :disabled="newFormTitle.trim() === ''"
          data-testid="new-form-create"
          @click="createForm"
        />
      </template>
    </Dialog>

    <ImportDialog v-model:visible="importVisible" />

    <Dialog
      v-model:visible="renameVisible"
      header="Rename form"
      modal
      :style="{ width: '28rem' }"
    >
      <label class="dialog-field">
        <span>Form title</span>
        <InputText v-model="renameTitle" data-testid="rename-title" @keyup.enter="applyRename" />
      </label>
      <template #footer>
        <Button label="Cancel" severity="secondary" text @click="renameVisible = false" />
        <Button label="Rename" :disabled="renameTitle.trim() === ''" @click="applyRename" />
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
  text-align: left;
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
