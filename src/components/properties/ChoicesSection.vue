<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import CascadeEditor from '@/components/choices/CascadeEditor.vue'
import HelpPopover from '@/components/help/HelpPopover.vue'
import { displayText, setText } from '@/core/model/display'
import { newChoiceList } from '@/core/model/factory'
import { flatten } from '@/core/model/ops'
import type { Choice, ChoiceList, FormDocument, QuestionNode } from '@/core/model/types'
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ node: QuestionNode }>()

const { t } = useAppI18n()
const form = useFormStore()
const editor = useEditorStore()

const list = computed(() =>
  props.node.listRef !== undefined ? form.doc?.choiceLists[props.node.listRef] : undefined
)

const listOptions = computed(() =>
  Object.keys(form.doc?.choiceLists ?? {}).map((name) => ({ name }))
)

const usedByCount = computed(() => {
  if (form.doc === null || props.node.listRef === undefined) return 0
  return flatten(form.doc.children as FormDocument['children'])
    .filter((n) => n.kind === 'question' && n.listRef === props.node.listRef)
    .length
})

const bindList = (name: string | null): void => {
  form.updateNode(props.node.id, t('properties.choices.undoChangeList'), (n) => {
    if (n.kind === 'question') n.listRef = name ?? undefined
  })
}

const createList = (): void => {
  form.mutate(t('properties.choices.undoNewList'), (d) => {
    const created = newChoiceList(d)
    const live = flatten(d.children).find((n) => n.id === props.node.id)
    if (live !== undefined && live.kind === 'question') live.listRef = created.name
  })
}

const editChoices = (fn: (list: ChoiceList) => void): void => {
  form.mutate(t('properties.choices.undoEditChoices'), (d) => {
    const ref = props.node.listRef
    if (ref === undefined) return
    const target = d.choiceLists[ref]
    if (target !== undefined) fn(target)
  }, { coalesce: true })
}

const setChoiceName = (index: number, value: string): void => {
  editChoices((l) => { l.choices[index].name = value })
}

const setChoiceLabel = (index: number, value: string): void => {
  editChoices((l) => { l.choices[index].label = setText(l.choices[index].label, value) })
}

const addChoice = (): void => {
  editChoices((l) => {
    l.choices.push({ name: `option_${l.choices.length + 1}`, label: {} })
  })
}

const removeChoice = (index: number): void => {
  editChoices((l) => { l.choices.splice(index, 1) })
}

// Drag reorder goes through the same mutate() path as any choice edit, so a
// single undo restores the previous order.
const reorderChoices = (value: Choice[]): void => {
  editChoices((l) => { l.choices.splice(0, l.choices.length, ...value) })
}
</script>

<template>
  <section class="prop-section">
    <label class="prop-field">
      <span>{{ t('properties.choices.listLabel') }} <template v-if="usedByCount > 1">{{ t('properties.choices.usedBySuffix', { count: usedByCount }) }}</template><HelpPopover field="choiceList" /></span>
      <div class="list-binding">
        <Select
          :model-value="node.listRef ?? null"
          :options="listOptions"
          option-label="name"
          option-value="name"
          :placeholder="t('properties.choices.selectListPlaceholder')"
          class="list-select"
          data-testid="prop-choice-list"
          @update:model-value="bindList"
        />
        <Button
          v-tooltip.left="t('properties.choices.newList')"
          icon="pi pi-plus"
          severity="secondary"
          :aria-label="t('properties.choices.newList')"
          @click="createList"
        />
        <Button
          v-tooltip.left="t('properties.choices.manageLists')"
          icon="pi pi-cog"
          severity="secondary"
          :aria-label="t('properties.choices.manageLists')"
          data-testid="open-choice-lists"
          @click="editor.activeDialog = 'choice-lists'"
        />
      </div>
    </label>

    <div v-if="list" class="choices-editor" data-testid="choices-editor">
      <VueDraggable
        :model-value="list.choices"
        group="choices"
        :sort="true"
        :animation="150"
        handle=".choice-drag"
        ghost-class="choice-ghost"
        class="choice-rows"
        @update:model-value="reorderChoices"
      >
        <div v-for="(choice, i) in list.choices" :key="i" class="choice-row">
          <i class="pi pi-bars choice-drag" aria-hidden="true" />
          <InputText
            :model-value="choice.name"
            :placeholder="t('properties.choices.valuePlaceholder')"
            class="choice-name"
            :data-testid="`choice-name-${i}`"
            @update:model-value="setChoiceName(i, $event ?? '')"
          />
          <InputText
            :model-value="displayText(choice.label)"
            :placeholder="t('properties.choices.labelPlaceholder')"
            class="choice-label"
            :data-testid="`choice-label-${i}`"
            @update:model-value="setChoiceLabel(i, $event ?? '')"
          />
          <Button
            icon="pi pi-times"
            severity="secondary"
            text
            rounded
            size="small"
            :aria-label="t('properties.choices.removeChoice')"
            @click="removeChoice(i)"
          />
        </div>
      </VueDraggable>
      <Button
        :label="t('properties.choices.addChoice')"
        icon="pi pi-plus"
        severity="secondary"
        text
        size="small"
        data-testid="add-choice"
        @click="addChoice"
      />
      <small v-if="usedByCount > 1" class="shared-warning">
        {{ t('properties.choices.sharedWarning', usedByCount - 1) }}
      </small>

      <CascadeEditor :node="node" />
    </div>
  </section>
</template>

<style scoped>
@import './prop-section.css';

.list-binding {
  display: flex;
  gap: var(--odk-spacing-s);
}

.list-select {
  flex: 1;
}

.choices-editor {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.choice-rows {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.choice-row {
  display: grid;
  grid-template-columns: auto minmax(96px, 2fr) 3fr auto;
  gap: var(--odk-spacing-s);
  align-items: center;
}

.choice-drag {
  cursor: grab;
  color: var(--odk-light-muted-text-color);
  font-size: 0.75rem;
  touch-action: none;
}

.choice-name {
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--odk-hint-font-size);
}

.choice-label {
  min-width: 0;
}

.choice-rows :deep(.choice-ghost) {
  opacity: 0.5;
}

.shared-warning {
  color: var(--odk-warning-text-color);
  font-size: 0.75rem;
}
</style>
