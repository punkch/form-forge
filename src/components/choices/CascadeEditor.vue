<script setup lang="ts">
import Button from 'primevue/button'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, ref, watch } from 'vue'

import ExpressionInput from '@/components/properties/ExpressionInput.vue'
import {
  buildSimpleChoiceFilter,
  ensureFilterColumn,
  extraColumns,
  parseSimpleChoiceFilter,
} from '@/core/model/choice-lists'
import { displayText } from '@/core/model/display'
import { findNode, flatten } from '@/core/model/ops'
import type { FormDocument, QuestionNode } from '@/core/model/types'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ node: QuestionNode }>()

const form = useFormStore()

const list = computed(() =>
  props.node.listRef !== undefined ? form.doc?.choiceLists[props.node.listRef] : undefined
)

const filter = computed(() => props.node.choiceFilter ?? '')
const parsed = computed(() => parseSimpleChoiceFilter(props.node.choiceFilter))
const isSimple = computed(() => filter.value.trim() === '' || parsed.value !== null)

// Derived mode: a filter the visual editor can't represent forces raw mode;
// the toggle only adds raw mode on top of representable filters.
const advanced = ref(false)
const rawMode = computed({
  get: () => advanced.value || !isSimple.value,
  set: (value: boolean) => { advanced.value = value },
})

/** Any select_one BEFORE this question in document order can be the parent. */
const parentCandidates = computed<QuestionNode[]>(() => {
  if (form.doc === null) return []
  const flat = flatten((form.doc as FormDocument).children)
  const selfIndex = flat.findIndex((n) => n.id === props.node.id)
  return flat
    .slice(0, selfIndex === -1 ? flat.length : selfIndex)
    .filter((n): n is QuestionNode =>
      n.kind === 'question' && n.type === 'select_one' && n.listRef !== undefined)
})

const parentOptions = computed(() =>
  parentCandidates.value.map((q) => ({
    label: displayText(q.label) === '' ? q.name : `${displayText(q.label)} (${q.name})`,
    value: q.name,
  }))
)

const selParent = ref<string | null>(parsed.value?.parentField ?? null)
const selColumn = ref<string | null>(parsed.value?.column ?? null)

watch(parsed, (p) => {
  if (p !== null) {
    selParent.value = p.parentField
    selColumn.value = p.column
  }
})

const columnOptions = computed(() => {
  const existing = list.value === undefined ? [] : extraColumns(list.value)
  const pending = selColumn.value
  return (pending !== null && pending !== '' && !existing.includes(pending)
    ? [...existing, pending]
    : existing
  ).map((name) => ({ name }))
})

const applyFilter = (): void => {
  const parent = selParent.value
  const column = selColumn.value?.trim() ?? ''
  if (parent === null || column === '') return
  form.mutate('Configure cascade', (d) => {
    const live = findNode(d, props.node.id)
    if (live === null || live.kind !== 'question' || live.listRef === undefined) return
    live.choiceFilter = buildSimpleChoiceFilter(column, parent)
    const liveList = d.choiceLists[live.listRef]
    if (liveList !== undefined) ensureFilterColumn(liveList, column)
  })
}

const setParent = (name: string | null): void => {
  selParent.value = name
  if (name === null) clearFilter()
  else applyFilter()
}

const setColumn = (name: string | null): void => {
  selColumn.value = name === null ? null : name.trim()
  applyFilter()
}

const clearFilter = (): void => {
  form.mutate('Configure cascade', (d) => {
    const live = findNode(d, props.node.id)
    if (live !== null && live.kind === 'question') live.choiceFilter = undefined
  })
}

const setRawFilter = (value: string): void => {
  form.updateNode(props.node.id, 'Edit choice filter', (n) => {
    if (n.kind === 'question') n.choiceFilter = value === '' ? undefined : value
  })
}

/** The parent question's choices — the allowed values of the filter column. */
const parentChoiceOptions = computed(() => {
  const parent = parentCandidates.value.find((q) => q.name === selParent.value)
  const parentList = parent?.listRef !== undefined ? form.doc?.choiceLists[parent.listRef] : undefined
  return (parentList?.choices ?? []).map((c) => ({
    label: displayText(c.label) === '' ? c.name : `${displayText(c.label)} (${c.name})`,
    value: c.name,
  }))
})

const assignmentsReady = computed(() =>
  parsed.value !== null && list.value !== undefined && parentChoiceOptions.value.length > 0
)

const choiceValue = (index: number): string | null => {
  const column = parsed.value?.column
  if (column === undefined) return null
  const value = list.value?.choices[index]?.extras?.[column]
  return value === undefined || value === '' ? null : value
}

const setChoiceValue = (index: number, value: string | null): void => {
  const column = parsed.value?.column
  const listName = props.node.listRef
  if (column === undefined || listName === undefined) return
  form.mutate('Assign filter value', (d) => {
    const choice = d.choiceLists[listName]?.choices[index]
    if (choice === undefined) return
    choice.extras = { ...choice.extras, [column]: value ?? '' }
  })
}
</script>

<template>
  <div v-if="list" class="cascade-editor" data-testid="cascade-editor">
    <div class="cascade-header">
      <span class="cascade-title">Cascading filter</span>
      <label class="raw-toggle">
        <ToggleSwitch
          :model-value="rawMode"
          :disabled="!isSimple"
          data-testid="cascade-advanced-toggle"
          @update:model-value="rawMode = $event"
        />
        <span>Advanced</span>
      </label>
    </div>

    <template v-if="!rawMode">
      <p v-if="parentOptions.length === 0" class="cascade-note">
        Add a select_one question above this one to filter these choices by its answer.
      </p>
      <template v-else>
        <label class="prop-field">
          <span>Filter by (parent question)</span>
          <Select
            :model-value="selParent"
            :options="parentOptions"
            option-label="label"
            option-value="value"
            show-clear
            placeholder="No filter"
            data-testid="cascade-parent"
            @update:model-value="setParent"
          />
        </label>

        <label v-if="selParent !== null" class="prop-field">
          <span>Filter column</span>
          <Select
            :model-value="selColumn"
            :options="columnOptions"
            option-label="name"
            option-value="name"
            editable
            placeholder="e.g. state"
            data-testid="cascade-column"
            @update:model-value="setColumn"
          />
        </label>

        <div v-if="assignmentsReady" class="cascade-assignments" data-testid="cascade-assignments">
          <span class="assignments-title">Show choice when {{ selParent }} is:</span>
          <div v-for="(choice, i) in list.choices" :key="i" class="assignment-row">
            <span class="assignment-choice">{{ displayText(choice.label) || choice.name }}</span>
            <Select
              :model-value="choiceValue(i)"
              :options="parentChoiceOptions"
              option-label="label"
              option-value="value"
              show-clear
              placeholder="always"
              class="assignment-select"
              :data-testid="`cascade-value-${i}`"
              @update:model-value="setChoiceValue(i, $event)"
            />
          </div>
        </div>

        <small v-if="filter !== ''" class="cascade-expr">
          choice_filter: <code>{{ filter }}</code>
        </small>
      </template>
    </template>

    <template v-else>
      <label class="prop-field">
        <span>choice_filter expression</span>
        <ExpressionInput
          :model-value="filter"
          field="choiceFilter"
          :node-id="node.id"
          placeholder="e.g. state=${state} and county=${county}"
          @update:model-value="setRawFilter"
        />
      </label>
      <Button
        v-if="filter !== ''"
        label="Remove filter"
        severity="secondary"
        text
        size="small"
        data-testid="cascade-clear"
        @click="clearFilter"
      />
    </template>
  </div>
</template>

<style scoped>
@import '../properties/prop-section.css';

.cascade-editor {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
  border-top: 1px solid var(--odk-border-color);
  padding-top: var(--odk-spacing-m);
  margin-top: var(--odk-spacing-m);
}

.cascade-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cascade-title {
  font-weight: 500;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.raw-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.cascade-note {
  margin: 0;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.cascade-assignments {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.assignments-title {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.assignment-row {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
}

.assignment-choice {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--odk-hint-font-size);
}

.assignment-select {
  width: 55%;
}

.cascade-expr {
  color: var(--odk-muted-text-color);
  font-size: 0.75rem;
}

.cascade-expr code {
  background: var(--odk-light-background-color);
  padding: 1px 4px;
  border-radius: 3px;
}
</style>
