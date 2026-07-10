<script lang="ts">
import type { FormNode } from '@/core/model/types'
import type { QuestionTypeDefinition } from '@/core/registry/question-types'

/**
 * Whether a node can feed an entity property: any question whose bind carries
 * a value (so not display-only notes, meta-instance children or the model-less
 * csv-external rows). Calculates count — they are a common save_to source.
 */
export const canSaveTo = (node: FormNode | null, def: QuestionTypeDefinition | undefined): boolean =>
  node !== null &&
  node.kind === 'question' &&
  def !== undefined &&
  def.xform.bindType !== undefined &&
  def.xform.inMeta !== true &&
  def.category !== 'display' &&
  node.type !== 'csv-external'
</script>

<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed } from 'vue'

import HelpPopover from '@/components/help/HelpPopover.vue'
import type { QuestionNode } from '@/core/model/types'
import { useAppI18n } from '@/i18n'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ node: QuestionNode }>()

const { t } = useAppI18n()
const form = useFormStore()

const datasetName = computed(() => form.doc?.entities?.datasetName ?? '')

/** Reserved/duplicate/invalid save_to problems for this question. */
const saveToIssues = computed(() =>
  (form.issuesByNode.get(props.node.id) ?? []).filter((i) => i.code.startsWith('entities.')))

const setSaveTo = (value: string): void => {
  form.updateNode(props.node.id, t('properties.entity.undoEditSaveTo'), (n) => {
    if (n.kind !== 'question') return
    if (value.trim() === '') delete n.saveTo
    else n.saveTo = value
  })
}
</script>

<template>
  <section class="prop-section">
    <label class="prop-field">
      <span>{{ t('properties.entity.saveTo') }}<HelpPopover field="saveTo" /></span>
      <InputText
        :model-value="node.saveTo ?? ''"
        class="prop-name-input"
        :invalid="saveToIssues.length > 0"
        :placeholder="t('properties.entity.saveToPlaceholder')"
        data-testid="prop-save-to"
        @update:model-value="setSaveTo($event ?? '')"
      />
      <small
        v-if="node.saveTo && saveToIssues.length === 0"
        class="entity-hint"
      >{{ t('properties.entity.saveToHint', { dataset: datasetName }) }}</small>
      <small
        v-for="(issue, i) in saveToIssues"
        :key="i"
        class="prop-issue"
        data-testid="save-to-issue"
      >{{ issue.message }}</small>
    </label>
  </section>
</template>

<style scoped>
@import './prop-section.css';

.entity-hint {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}
</style>
