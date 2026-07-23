<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import { useConfirm } from 'primevue/useconfirm'
import { computed, nextTick, ref, shallowRef, useTemplateRef, watch } from 'vue'

import { useAppI18n } from '@/i18n'
import type { FormRecord, TemplateRecord } from '@/persistence/db'
import * as templatesRepo from '@/persistence/templates-repo'
import { useUiStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'
import { bundledTemplates, migrateTemplateDoc, type BundledTemplate } from '@/templates'

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ created: [record: FormRecord] }>()

const workspace = useWorkspaceStore()
const ui = useUiStore()
const confirm = useConfirm()
const { t } = useAppI18n()

type Selection =
  | { kind: 'blank' }
  | { kind: 'bundled', template: BundledTemplate }
  | { kind: 'local', record: TemplateRecord }

const step = ref<'gallery' | 'title'>('gallery')
// shallowRef (like localTemplates below): a deep-reactive selection would
// proxy the template doc and break instantiateTemplate's structuredClone.
const selection = shallowRef<Selection>({ kind: 'blank' })
const title = ref('')
const creating = ref(false)
const loadError = ref(false)
// shallowRef: the stored docs go straight into instantiateTemplate's
// structuredClone, and a deep-reactive proxy would fail it (DataCloneError).
const localTemplates = shallowRef<TemplateRecord[]>([])
const titleInput = useTemplateRef<{ $el: HTMLElement } | null>('titleInput')

/** Bundled starters the user hasn't hidden — shown in the main grid. */
const visibleBundled = computed(() => bundledTemplates.filter((template) => !ui.isBundledTemplateHidden(template.id)))
/** Bundled starters the user hid — listed in the "Hidden starters" disclosure. */
const hiddenBundled = computed(() => bundledTemplates.filter((template) => ui.isBundledTemplateHidden(template.id)))

/** Whether the hidden-starters list is expanded (collapsed on every open). */
const hiddenExpanded = ref(false)
const editVisible = ref(false)
/** Mirrors the global ConfirmDialog's open state (it has no visibility model we
 * can bind), so `nestedOverlayOpen` below can park this dialog's Esc handling. */
const confirmOpen = ref(false)
const editTarget = ref<TemplateRecord | null>(null)
const editName = ref('')
const editDescription = ref('')

const focusTitle = async (): Promise<void> => {
  await nextTick()
  titleInput.value?.$el.focus()
}

/** Re-read the gallery's saved templates. Every mutation below resyncs through
 * here rather than patching the array in place — `listTemplates` orders by
 * `updatedAt`, so an edited template also has to move to the front. */
const refreshLocalTemplates = async (): Promise<void> => {
  localTemplates.value = await templatesRepo.listTemplates()
}

watch(visible, async (open) => {
  if (!open) return
  step.value = 'gallery'
  selection.value = { kind: 'blank' }
  title.value = ''
  loadError.value = false
  editVisible.value = false
  hiddenExpanded.value = false
  await refreshLocalTemplates()
}, { immediate: true })

const pick = async (next: Selection): Promise<void> => {
  selection.value = next
  loadError.value = false
  step.value = 'title'
  title.value = next.kind === 'bundled'
    ? t(next.template.titleKey)
    : next.kind === 'local' ? next.record.title : ''
  await focusTitle()
}

const backToGallery = (): void => {
  step.value = 'gallery'
  selection.value = { kind: 'blank' }
  loadError.value = false
}

/** What the confirmation step shows for the current selection. */
const selectedSummary = computed(() => {
  const current = selection.value
  if (current.kind === 'bundled') {
    return {
      title: t(current.template.titleKey),
      description: t(current.template.descriptionKey),
      questionCount: current.template.questionCount,
      preview: current.template.preview,
    }
  }
  if (current.kind === 'local') {
    return {
      title: current.record.title,
      description: current.record.description,
      questionCount: current.record.questionCount,
      preview: current.record.preview,
    }
  }
  return {
    title: t('library.newFormDialog.blankTitle'),
    description: t('library.newFormDialog.blankDescription'),
    questionCount: null,
    preview: [],
  }
})

const create = async (): Promise<void> => {
  const trimmed = title.value.trim()
  if (trimmed === '' || creating.value) return
  creating.value = true
  loadError.value = false
  try {
    const current = selection.value
    let record: FormRecord
    if (current.kind === 'blank') {
      record = await workspace.createForm(trimmed)
    } else {
      const doc = current.kind === 'bundled'
        ? await current.template.load()
        : migrateTemplateDoc(current.record.doc)
      record = await workspace.createFormFromTemplate(doc, trimmed)
    }
    visible.value = false
    emit('created', record)
  } catch (error) {
    console.error('Failed to create the form', error)
    loadError.value = true
  } finally {
    creating.value = false
  }
}

const removeLocal = async (record: TemplateRecord): Promise<void> => {
  await templatesRepo.deleteTemplate(record.id)
  await refreshLocalTemplates()
}

/**
 * True while a nested overlay (the delete confirmation or the edit dialog)
 * sits on top of this one. It parks the gallery's own Esc handling so a single
 * Escape backs out ONE level — closing just the overlay — instead of collapsing
 * the gallery underneath it too (both dialogs otherwise see the same keydown).
 */
const nestedOverlayOpen = computed(() => confirmOpen.value || editVisible.value)

const confirmRemoveLocal = (record: TemplateRecord): void => {
  confirmOpen.value = true
  confirm.require({
    header: t('library.newFormDialog.deleteLocalConfirmHeader'),
    message: t('library.newFormDialog.deleteLocalConfirmMessage', { title: record.title }),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('common.delete'),
    rejectLabel: t('common.cancel'),
    acceptProps: { severity: 'danger' },
    accept: () => { void removeLocal(record) },
    onHide: () => { confirmOpen.value = false },
  })
}

const startEdit = (record: TemplateRecord): void => {
  editTarget.value = record
  editName.value = record.title
  editDescription.value = record.description
  editVisible.value = true
}

const applyEdit = async (): Promise<void> => {
  const target = editTarget.value
  const name = editName.value.trim()
  if (target === null || name === '') return
  await templatesRepo.updateTemplate(target.id, { title: name, description: editDescription.value.trim() })
  await refreshLocalTemplates()
  editVisible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="t('library.newFormDialog.header')"
    modal
    :close-on-escape="!nestedOverlayOpen"
    :style="{ width: '46rem' }"
    @show="focusTitle"
  >
    <div v-if="step === 'gallery'" class="gallery">
      <button
        type="button"
        class="template-card blank-card"
        data-testid="new-form-blank"
        @click="pick({ kind: 'blank' })"
      >
        <span class="template-title"><i class="pi pi-file" /> {{ t('library.newFormDialog.blankTitle') }}</span>
        <span class="template-description">{{ t('library.newFormDialog.blankDescription') }}</span>
      </button>

      <p class="gallery-label">{{ t('library.newFormDialog.galleryLabel') }}</p>
      <div class="template-grid">
        <div
          v-for="template in visibleBundled"
          :key="template.id"
          class="template-card actionable-card"
        >
          <button
            type="button"
            class="actionable-card-main"
            :data-testid="`new-form-template-${template.id}`"
            @click="pick({ kind: 'bundled', template })"
          >
            <span class="template-title">{{ t(template.titleKey) }}</span>
            <span class="template-description">{{ t(template.descriptionKey) }}</span>
            <span class="template-meta">{{ t('library.card.questionCount', { count: template.questionCount }, template.questionCount) }}</span>
            <span class="template-preview">{{ template.preview.join(' · ') }}</span>
          </button>
          <div class="actionable-card-actions">
            <Button
              v-tooltip.top="t('library.newFormDialog.hideStarter', { title: t(template.titleKey) })"
              icon="pi pi-eye-slash"
              severity="secondary"
              text
              rounded
              size="small"
              :aria-label="t('library.newFormDialog.hideStarter', { title: t(template.titleKey) })"
              :data-testid="`new-form-starter-hide-${template.id}`"
              @click="ui.hideBundledTemplate(template.id)"
            />
          </div>
        </div>

        <div
          v-for="record in localTemplates"
          :key="record.id"
          class="template-card actionable-card"
          data-testid="new-form-local-template"
        >
          <button type="button" class="actionable-card-main" data-testid="new-form-local-open" @click="pick({ kind: 'local', record })">
            <span class="template-title">
              {{ record.title }}
              <Tag :value="t('library.newFormDialog.localTag')" severity="secondary" />
            </span>
            <span v-if="record.description !== ''" class="template-description">{{ record.description }}</span>
            <span class="template-meta">{{ t('library.card.questionCount', { count: record.questionCount }, record.questionCount) }}</span>
            <span class="template-preview">{{ record.preview.join(' · ') }}</span>
          </button>
          <div class="actionable-card-actions">
            <Button
              v-tooltip.top="t('library.newFormDialog.editLocal', { title: record.title })"
              icon="pi pi-pencil"
              severity="secondary"
              text
              rounded
              size="small"
              :aria-label="t('library.newFormDialog.editLocal', { title: record.title })"
              data-testid="new-form-local-rename"
              @click="startEdit(record)"
            />
            <Button
              v-tooltip.top="t('library.newFormDialog.deleteLocal', { title: record.title })"
              icon="pi pi-trash"
              severity="secondary"
              text
              rounded
              size="small"
              :aria-label="t('library.newFormDialog.deleteLocal', { title: record.title })"
              data-testid="new-form-local-delete"
              @click="confirmRemoveLocal(record)"
            />
          </div>
        </div>
      </div>

      <!-- Collapsed by default: hiding a starter is meant to declutter the
           gallery, so the hidden ones must not just reappear as a permanent
           list underneath it. Restore all stays reachable without expanding. -->
      <div v-if="hiddenBundled.length > 0" class="hidden-starters" data-testid="new-form-hidden-starters">
        <div class="hidden-starters-header">
          <button
            type="button"
            class="hidden-starters-toggle"
            :aria-expanded="hiddenExpanded"
            data-testid="new-form-hidden-starters-toggle"
            @click="hiddenExpanded = !hiddenExpanded"
          >
            <i :class="hiddenExpanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" aria-hidden="true" />
            <span>{{ t('library.newFormDialog.hiddenStarters', { count: hiddenBundled.length }) }}</span>
          </button>
          <Button
            :label="t('library.newFormDialog.restoreAllStarters')"
            severity="secondary"
            text
            size="small"
            data-testid="new-form-restore-starters"
            @click="ui.resetHiddenBundledTemplates()"
          />
        </div>
        <ul v-if="hiddenExpanded" class="hidden-starters-list">
          <li v-for="template in hiddenBundled" :key="template.id" class="hidden-starter-row">
            <span>{{ t(template.titleKey) }}</span>
            <Button
              v-tooltip.top="t('library.newFormDialog.unhideStarter', { title: t(template.titleKey) })"
              icon="pi pi-eye"
              severity="secondary"
              text
              rounded
              size="small"
              :aria-label="t('library.newFormDialog.unhideStarter', { title: t(template.titleKey) })"
              :data-testid="`new-form-starter-unhide-${template.id}`"
              @click="ui.unhideBundledTemplate(template.id)"
            />
          </li>
        </ul>
      </div>
    </div>

    <div v-else class="confirm">
      <Button
        icon="pi pi-arrow-left"
        :label="t('library.newFormDialog.allTemplates')"
        severity="secondary"
        text
        size="small"
        class="confirm-back"
        data-testid="new-form-back"
        @click="backToGallery"
      />
      <div class="template-card selected-card">
        <span class="template-title">{{ selectedSummary.title }}</span>
        <span v-if="selectedSummary.description !== ''" class="template-description">{{ selectedSummary.description }}</span>
        <span v-if="selectedSummary.questionCount !== null" class="template-meta">
          {{ t('library.card.questionCount', { count: selectedSummary.questionCount }, selectedSummary.questionCount) }}
        </span>
        <span v-if="selectedSummary.preview.length > 0" class="template-preview">{{ selectedSummary.preview.join(' · ') }}</span>
      </div>
    </div>

    <label class="dialog-field">
      <span>{{ t('library.newFormDialog.formTitle') }}</span>
      <InputText
        ref="titleInput"
        v-model="title"
        :placeholder="t('library.newFormDialog.placeholder')"
        data-testid="new-form-title"
        @keyup.enter="create"
      />
    </label>
    <p v-if="title.trim() === ''" class="create-hint" data-testid="new-form-create-hint">
      {{ t('library.newFormDialog.createHint') }}
    </p>
    <p v-if="loadError" class="load-error" data-testid="new-form-error">
      {{ t('library.newFormDialog.loadFailed') }}
    </p>

    <template #footer>
      <Button :label="t('common.cancel')" severity="secondary" text @click="visible = false" />
      <Button
        :label="t('library.newFormDialog.create')"
        :disabled="title.trim() === '' || creating"
        :loading="creating"
        data-testid="new-form-create"
        @click="create"
      />
    </template>
  </Dialog>

  <Dialog
    v-model:visible="editVisible"
    :header="t('library.newFormDialog.editHeader')"
    modal
    :style="{ width: '28rem' }"
    data-testid="template-edit-dialog"
  >
    <div class="dialog-fields">
      <label class="dialog-field">
        <span>{{ t('library.newFormDialog.editName') }}</span>
        <InputText v-model="editName" data-testid="template-edit-name" @keyup.enter="applyEdit" />
      </label>
      <label class="dialog-field">
        <span>{{ t('library.newFormDialog.editDescription') }}</span>
        <Textarea v-model="editDescription" rows="2" auto-resize data-testid="template-edit-description" />
      </label>
      <p class="dialog-hint" data-testid="template-edit-content-hint">
        {{ t('library.newFormDialog.editContentHint') }}
      </p>
    </div>
    <template #footer>
      <Button
        :label="t('common.cancel')"
        severity="secondary"
        text
        data-testid="template-edit-cancel"
        @click="editVisible = false"
      />
      <Button
        :label="t('common.save')"
        :disabled="editName.trim() === ''"
        data-testid="template-edit-save"
        @click="applyEdit"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.gallery {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
  margin-bottom: var(--odk-spacing-l);
}

.gallery-label {
  margin: 0;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr));
  gap: var(--odk-spacing-m);
}

.template-card {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
  background: var(--odk-base-background-color);
  padding: var(--odk-spacing-l);
  text-align: start;
  font-family: inherit;
  color: var(--odk-text-color);
}

button.template-card,
.actionable-card-main {
  cursor: pointer;
}

button.template-card:hover,
.actionable-card:hover {
  border-color: var(--odk-primary-border-color);
}

.blank-card {
  align-self: stretch;
}

/* Shared by local-template and bundled-starter cards: both pair a selectable
   button with one or more corner icon actions (delete/rename, hide). */
.actionable-card {
  position: relative;
}

.actionable-card-main {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
  border: none;
  background: none;
  padding: 0;
  text-align: start;
  font-family: inherit;
  color: var(--odk-text-color);
}

.actionable-card-actions {
  position: absolute;
  top: var(--odk-spacing-s);
  inset-inline-end: var(--odk-spacing-s);
  display: flex;
  gap: var(--odk-spacing-s);
}

.template-title {
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
}

.template-description {
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.template-meta {
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.template-preview {
  color: var(--odk-light-muted-text-color, var(--odk-muted-text-color));
  font-size: var(--odk-hint-font-size);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.hidden-starters {
  margin-top: var(--odk-spacing-m);
  padding-top: var(--odk-spacing-m);
  border-top: 1px solid var(--odk-border-color);
}

.hidden-starters-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--odk-spacing-m);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.hidden-starters-toggle {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.hidden-starters-toggle:hover {
  color: var(--odk-text-color);
}

.hidden-starters-list {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
  margin: var(--odk-spacing-s) 0 0;
  padding: 0;
  list-style: none;
}

.hidden-starter-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--odk-spacing-m);
}

.confirm {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
  margin-bottom: var(--odk-spacing-l);
}

.confirm-back {
  align-self: flex-start;
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

.create-hint,
.dialog-hint {
  margin: var(--odk-spacing-s) 0 0;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.load-error {
  margin: var(--odk-spacing-s) 0 0;
  color: var(--odk-error-text-color);
  font-size: var(--odk-hint-font-size);
}
</style>
