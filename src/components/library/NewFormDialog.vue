<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import { computed, nextTick, ref, shallowRef, useTemplateRef, watch } from 'vue'

import { migrateDoc } from '@/core/model/migrate'
import type { FormDocument } from '@/core/model/types'
import { useAppI18n } from '@/i18n'
import type { FormRecord, TemplateRecord } from '@/persistence/db'
import * as templatesRepo from '@/persistence/templates-repo'
import { useWorkspaceStore } from '@/stores/workspace'
import { bundledTemplates, type BundledTemplate } from '@/templates'

const visible = defineModel<boolean>('visible', { required: true })
const emit = defineEmits<{ created: [record: FormRecord] }>()

const workspace = useWorkspaceStore()
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

const focusTitle = async (): Promise<void> => {
  await nextTick()
  titleInput.value?.$el.focus()
}

watch(visible, async (open) => {
  if (!open) return
  step.value = 'gallery'
  selection.value = { kind: 'blank' }
  title.value = ''
  loadError.value = false
  localTemplates.value = await templatesRepo.listTemplates()
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

/** Gate a local template's stored doc through migrateDoc, like the bundled
 * loader does — a stale/corrupt local record throws instead of reaching the
 * editor. */
const migrateLocalDoc = (raw: FormDocument): FormDocument => {
  const { doc, issues } = migrateDoc(raw)
  if (doc === null) {
    throw new Error(`Local template failed to load: ${issues.map((i) => i.message).join('; ')}`)
  }
  return doc
}

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
        : migrateLocalDoc(current.record.doc)
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
  localTemplates.value = await templatesRepo.listTemplates()
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="t('library.newFormDialog.header')"
    modal
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
        <button
          v-for="template in bundledTemplates"
          :key="template.id"
          type="button"
          class="template-card"
          :data-testid="`new-form-template-${template.id}`"
          @click="pick({ kind: 'bundled', template })"
        >
          <span class="template-title">{{ t(template.titleKey) }}</span>
          <span class="template-description">{{ t(template.descriptionKey) }}</span>
          <span class="template-meta">{{ t('library.card.questionCount', { count: template.questionCount }, template.questionCount) }}</span>
          <span class="template-preview">{{ template.preview.join(' · ') }}</span>
        </button>

        <div
          v-for="record in localTemplates"
          :key="record.id"
          class="template-card local-card"
          data-testid="new-form-local-template"
        >
          <button type="button" class="local-card-main" data-testid="new-form-local-open" @click="pick({ kind: 'local', record })">
            <span class="template-title">
              {{ record.title }}
              <Tag :value="t('library.newFormDialog.localTag')" severity="secondary" />
            </span>
            <span v-if="record.description !== ''" class="template-description">{{ record.description }}</span>
            <span class="template-meta">{{ t('library.card.questionCount', { count: record.questionCount }, record.questionCount) }}</span>
            <span class="template-preview">{{ record.preview.join(' · ') }}</span>
          </button>
          <Button
            icon="pi pi-trash"
            severity="secondary"
            text
            rounded
            size="small"
            class="local-card-delete"
            :aria-label="t('library.newFormDialog.deleteLocal', { title: record.title })"
            data-testid="new-form-local-delete"
            @click="removeLocal(record)"
          />
        </div>
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
.local-card-main {
  cursor: pointer;
}

button.template-card:hover,
.local-card:hover {
  border-color: var(--odk-primary-border-color);
}

.blank-card {
  align-self: stretch;
}

.local-card {
  position: relative;
}

.local-card-main {
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

.local-card-delete {
  position: absolute;
  top: var(--odk-spacing-s);
  inset-inline-end: var(--odk-spacing-s);
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

.confirm {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
  margin-bottom: var(--odk-spacing-l);
}

.confirm-back {
  align-self: flex-start;
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

.create-hint {
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
