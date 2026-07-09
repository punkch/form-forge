<script setup lang="ts">
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed } from 'vue'

import CascadeEditor from '@/components/choices/CascadeEditor.vue'
import { displayText, setText } from '@/core/model/display'
import { newChoiceList } from '@/core/model/factory'
import { flatten } from '@/core/model/ops'
import type { ChoiceList, FormDocument, QuestionNode } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ node: QuestionNode }>()

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
  form.updateNode(props.node.id, 'Change choice list', (n) => {
    if (n.kind === 'question') n.listRef = name ?? undefined
  })
}

const createList = (): void => {
  form.mutate('New choice list', (d) => {
    const created = newChoiceList(d)
    const live = flatten(d.children).find((n) => n.id === props.node.id)
    if (live !== undefined && live.kind === 'question') live.listRef = created.name
  })
}

const editChoices = (fn: (list: ChoiceList) => void): void => {
  form.mutate('Edit choices', (d) => {
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
</script>

<template>
  <section class="prop-section">
    <label class="prop-field">
      <span>Choice list <template v-if="usedByCount > 1">(used by {{ usedByCount }} questions)</template></span>
      <div class="list-binding">
        <Select
          :model-value="node.listRef ?? null"
          :options="listOptions"
          option-label="name"
          option-value="name"
          placeholder="Select a list"
          class="list-select"
          data-testid="prop-choice-list"
          @update:model-value="bindList"
        />
        <Button
          v-tooltip.left="'New choice list'"
          icon="pi pi-plus"
          severity="secondary"
          aria-label="New choice list"
          @click="createList"
        />
        <Button
          v-tooltip.left="'Manage choice lists'"
          icon="pi pi-cog"
          severity="secondary"
          aria-label="Manage choice lists"
          data-testid="open-choice-lists"
          @click="editor.activeDialog = 'choice-lists'"
        />
      </div>
    </label>

    <div v-if="list" class="choices-editor" data-testid="choices-editor">
      <div v-for="(choice, i) in list.choices" :key="i" class="choice-row">
        <InputText
          :model-value="choice.name"
          placeholder="value"
          class="choice-name"
          :data-testid="`choice-name-${i}`"
          @update:model-value="setChoiceName(i, $event ?? '')"
        />
        <InputText
          :model-value="displayText(choice.label)"
          placeholder="label"
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
          aria-label="Remove choice"
          @click="removeChoice(i)"
        />
      </div>
      <Button
        label="Add choice"
        icon="pi pi-plus"
        severity="secondary"
        text
        size="small"
        data-testid="add-choice"
        @click="addChoice"
      />
      <small v-if="usedByCount > 1" class="shared-warning">
        Changes affect {{ usedByCount - 1 }} other question{{ usedByCount > 2 ? 's' : '' }} using this list.
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

.choice-row {
  display: flex;
  gap: var(--odk-spacing-s);
  align-items: center;
}

.choice-name {
  width: 35%;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--odk-hint-font-size);
}

.choice-label {
  flex: 1;
}

.shared-warning {
  color: var(--odk-warning-text-color);
  font-size: 0.75rem;
}
</style>
