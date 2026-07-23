<script setup lang="ts">
// Slim read-only template picker for the editor canvas: appends a chosen
// template's fields to the end of the OPEN form as ordinary editable nodes,
// one undoable step, no confirmation. Deliberately NOT extracted from
// NewFormDialog (its two-step create flow, management actions and heavy e2e
// make sharing a component riskier than duplicating ~40 lines of card CSS).
import Dialog from 'primevue/dialog'
import Tag from 'primevue/tag'
import { computed, ref, shallowRef, watch } from 'vue'

import { useSelectionActions } from '@/composables/useSelectionActions'
import type { FormDocument } from '@/core/model/types'
import { useAppI18n } from '@/i18n'
import type { TemplateRecord } from '@/persistence/db'
import * as templatesRepo from '@/persistence/templates-repo'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'
import { useUiStore } from '@/stores/ui'
import { bundledTemplates, migrateTemplateDoc, type BundledTemplate } from '@/templates'

const { t } = useAppI18n()
const form = useFormStore()
const editor = useEditorStore()
const ui = useUiStore()
const { revealMergeResult } = useSelectionActions()

const visible = computed({
  get: () => editor.activeDialog === 'insert-template',
  set: (open: boolean) => { editor.activeDialog = open ? 'insert-template' : null },
})

/** Bundled starters the user hasn't hidden — mirrors NewFormDialog's gallery. */
const visibleBundled = computed(() => bundledTemplates.filter((template) => !ui.isBundledTemplateHidden(template.id)))

// shallowRef (NewFormDialog precedent): the stored docs feed
// form.insertTemplate's JSON-clone merge, and a deep-reactive proxy would
// fight that clone.
const localTemplates = shallowRef<TemplateRecord[]>([])

/** Re-entrancy latch: a fast double-click on a card would otherwise run the
 * insert twice (two undo entries) before the closing dialog unmounts —
 * NewFormDialog's `creating` guard, same shape. Reset when the dialog
 * reopens. */
const inserting = ref(false)

watch(visible, async (open) => {
  if (!open) return
  inserting.value = false
  localTemplates.value = await templatesRepo.listTemplates()
}, { immediate: true })

const isEmpty = computed(() => visibleBundled.value.length === 0 && localTemplates.value.length === 0)

/** Merge the loaded doc at the end of the open form, then close and reveal
 * what landed — same select-and-flash mechanics and degradation toast as a
 * clipboard paste (revealMergeResult). */
const finishInsert = (doc: FormDocument): void => {
  const result = form.insertTemplate(doc)
  if (result === null) return
  visible.value = false
  revealMergeResult(result)
}

const insertBundled = async (template: BundledTemplate): Promise<void> => {
  if (inserting.value) return
  inserting.value = true
  finishInsert(await template.load())
}

const insertLocal = (record: TemplateRecord): void => {
  if (inserting.value) return
  inserting.value = true
  finishInsert(migrateTemplateDoc(record.doc))
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="t('canvas.insertTemplate.header')"
    modal
    :style="{ width: '46rem' }"
    data-testid="insert-template-dialog"
  >
    <p class="insert-template-hint">{{ t('canvas.insertTemplate.hint') }}</p>

    <p v-if="isEmpty" class="insert-template-empty" data-testid="insert-template-empty">
      {{ t('canvas.insertTemplate.empty') }}
    </p>
    <div v-else class="template-grid">
      <button
        v-for="template in visibleBundled"
        :key="template.id"
        type="button"
        class="template-card"
        :data-testid="`insert-template-card-${template.id}`"
        @click="insertBundled(template)"
      >
        <span class="template-title">{{ t(template.titleKey) }}</span>
        <span class="template-description">{{ t(template.descriptionKey) }}</span>
        <span class="template-meta">{{ t('library.card.questionCount', { count: template.questionCount }, template.questionCount) }}</span>
        <span class="template-preview">{{ template.preview.join(' · ') }}</span>
      </button>

      <button
        v-for="record in localTemplates"
        :key="record.id"
        type="button"
        class="template-card"
        data-testid="insert-template-local"
        @click="insertLocal(record)"
      >
        <span class="template-title">
          {{ record.title }}
          <Tag :value="t('library.newFormDialog.localTag')" severity="secondary" />
        </span>
        <span v-if="record.description !== ''" class="template-description">{{ record.description }}</span>
        <span class="template-meta">{{ t('library.card.questionCount', { count: record.questionCount }, record.questionCount) }}</span>
        <span class="template-preview">{{ record.preview.join(' · ') }}</span>
      </button>
    </div>
  </Dialog>
</template>

<style scoped>
.insert-template-hint {
  margin: 0 0 var(--odk-spacing-m);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.insert-template-empty {
  margin: 0;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

/* Card look borrowed from NewFormDialog.vue's .template-card/-title/
   -description/-meta/-preview — deliberately duplicated, not extracted (see
   the top-of-file note). */
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
  cursor: pointer;
}

.template-card:hover {
  border-color: var(--odk-primary-border-color);
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
</style>
