<script setup lang="ts">
// Visual condition builder for `relevant` and `constraint` expressions.
//
// Mode is derived from the expression (the CascadeEditor pattern, scaled up):
// an expression the structured grammar can parse opens visually; anything
// else opens in the raw ExpressionInput with the Visual tab disabled — and is
// NEVER rewritten unless the user edits it. An empty expression opens in raw
// (the familiar placeholder) with the Visual tab one click away. Editing the
// raw text pins raw mode so the editor never flips out from under a typing
// user; visual edits re-serialize deterministically through the same
// update:modelValue path LogicSection already uses (undo labels preserved).
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'

import ConditionRow from '@/components/logic/ConditionRow.vue'
import { defaultLiteral, logicFieldOptions, nearestPrecedingFieldOption, selfFieldOption, type LogicFieldOption } from '@/components/logic/field-options'
import ExpressionInput from '@/components/properties/ExpressionInput.vue'
import {
  emptyTree,
  parseStructured,
  trySerializeStructured,
  type Condition,
  type ConditionGroup,
  type ConditionTree,
  type Join,
  type Operand,
} from '@/core/expr/structured'
import type { FormDocument, FormNode } from '@/core/model/types'
import { useAppI18n } from '@/i18n'
import { useFormStore } from '@/stores/form'

const props = defineProps<{
  modelValue: string
  /** Expression property this builder edits. */
  field: 'relevant' | 'constraint'
  node: FormNode
  placeholder?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { t } = useAppI18n()
const form = useFormStore()

// --- Fields -------------------------------------------------------------

const fields = computed<LogicFieldOption[]>(() =>
  form.doc === null ? [] : logicFieldOptions(form.doc as FormDocument, props.node.id))

/** Constraints compare against the current answer; relevance never does. */
const selfOption = computed<LogicFieldOption | null>(() =>
  props.field === 'constraint'
    ? selfFieldOption(props.node, t('properties.logic.selfOption'))
    : null)

/** A relevance condition needs another question to branch on; without one a
 * seed would be a meaningless self-comparison, so adding is disabled. */
const canSeed = computed(() => selfOption.value !== null || fields.value.length > 0)

// --- Mode (derived; raw is the escape hatch) ------------------------------

const parsedTree = computed<ConditionTree | null>(() => parseStructured(props.modelValue))
const isEmpty = computed(() => props.modelValue.trim() === '')
const canVisual = computed(() => isEmpty.value || parsedTree.value !== null)

/** The user's explicit tab choice; null = derive from the expression. */
const override = ref<'visual' | 'raw' | null>(null)

const mode = computed<'visual' | 'raw'>(() => {
  if (!canVisual.value) return 'raw'
  if (override.value !== null) return override.value
  return isEmpty.value ? 'raw' : 'visual'
})

const modeOptions = computed(() => [
  { label: t('properties.logic.modeVisual'), value: 'visual', disabled: !canVisual.value },
  { label: t('properties.logic.modeRaw'), value: 'raw', disabled: false },
])

const setMode = (value: 'visual' | 'raw' | null): void => {
  if (value !== null) override.value = value
}

/** Raw edits pin raw mode so the editor never flips away mid-typing. */
const onRawEdit = (value: string): void => {
  override.value = 'raw'
  emit('update:modelValue', value)
}

// --- Tree edits -----------------------------------------------------------

const tree = computed<ConditionTree>(() => parsedTree.value ?? emptyTree())

/** Single-item groups always join with 'and' (canonical form). */
const canonicalize = (group: ConditionGroup): void => {
  if (group.items.length === 1) group.join = 'and'
  for (const item of group.items) {
    if (item.kind === 'group') canonicalize(item)
  }
}

/** True when the last visual edit produced a literal XPath 1.0 cannot express
 * (a string with both quote kinds). We keep the previous expression instead of
 * emitting broken XPath and surface a hint pointing at the Raw editor. */
const unrepresentable = ref(false)

// A new expression (e.g. switching questions) always clears the stale hint;
// blocked edits leave modelValue untouched, so the hint persists until fixed.
watch(() => props.modelValue, () => { unrepresentable.value = false })

const emitTree = (next: ConditionTree): void => {
  canonicalize(next)
  const text = trySerializeStructured(next)
  if (text === null) {
    unrepresentable.value = true
    return
  }
  unrepresentable.value = false
  emit('update:modelValue', text)
}

const cloneTree = (): ConditionTree => structuredClone(tree.value)

const defaultCondition = (): Condition => {
  // Constraints compare against self; relevance seeds with the nearest
  // preceding answerable question — what the author most likely branches on —
  // rather than the form's first field (often an intro note's neighbor).
  const option = selfOption.value ??
    (form.doc === null ? undefined : nearestPrecedingFieldOption(form.doc as FormDocument, props.node.id))
  const operand: Operand = option === undefined || option.name === '.'
    ? { type: 'self' }
    : { type: 'field', name: option.name }
  return { kind: 'comparison', operand, op: '=', literal: defaultLiteral(option) }
}

/** path = [rootIndex] or [groupIndex, subIndex] (one nesting level). */
const updateAt = (path: number[], condition: Condition): void => {
  const next = cloneTree()
  if (path.length === 1) {
    next.items[path[0]] = condition
  } else {
    const group = next.items[path[0]]
    if (group === undefined || group.kind !== 'group') return
    group.items[path[1]] = condition
  }
  emitTree(next)
}

const removeAt = (path: number[]): void => {
  const next = cloneTree()
  if (path.length === 1) {
    next.items.splice(path[0], 1)
  } else {
    const group = next.items[path[0]]
    if (group === undefined || group.kind !== 'group') return
    group.items.splice(path[1], 1)
    if (group.items.length === 0) next.items.splice(path[0], 1)
  }
  emitTree(next)
}

const addCondition = (groupIndex?: number): void => {
  const next = cloneTree()
  if (groupIndex === undefined) {
    next.items.push(defaultCondition())
  } else {
    const group = next.items[groupIndex]
    if (group === undefined || group.kind !== 'group') return
    group.items.push(defaultCondition())
  }
  override.value = 'visual'
  emitTree(next)
}

const addGroup = (): void => {
  const next = cloneTree()
  next.items.push({ kind: 'group', join: 'and', items: [defaultCondition()] })
  override.value = 'visual'
  emitTree(next)
}

const setJoin = (join: Join | null, groupIndex?: number): void => {
  if (join === null) return
  const next = cloneTree()
  if (groupIndex === undefined) {
    next.join = join
  } else {
    const group = next.items[groupIndex]
    if (group === undefined || group.kind !== 'group') return
    group.join = join
  }
  emitTree(next)
}

const joinOptions = computed(() => [
  { label: t('properties.logic.joinAll'), value: 'and' },
  { label: t('properties.logic.joinAny'), value: 'or' },
])

// --- Constraint presets ----------------------------------------------------

const self: Operand = { type: 'self' }

const PRESET_TREES: Record<string, ConditionTree> = {
  range: {
    kind: 'group',
    join: 'and',
    items: [
      { kind: 'comparison', operand: self, op: '>=', literal: 0 },
      { kind: 'comparison', operand: self, op: '<=', literal: 100 },
    ],
  },
  phone: {
    kind: 'group',
    join: 'and',
    items: [{ kind: 'regex', operand: self, pattern: '^\\(?[0-9]{3}\\)?-?[0-9]{3}-?[0-9]{4}$' }],
  },
  email: {
    kind: 'group',
    join: 'and',
    items: [{ kind: 'regex', operand: self, pattern: '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[a-zA-Z]{2,4}$' }],
  },
  letters: {
    kind: 'group',
    join: 'and',
    items: [{ kind: 'regex', operand: self, pattern: '^[A-Za-z]+$' }],
  },
}

const presetOptions = computed(() => [
  { label: t('properties.logic.presetRange'), value: 'range' },
  { label: t('properties.logic.presetPhone'), value: 'phone' },
  { label: t('properties.logic.presetEmail'), value: 'email' },
  { label: t('properties.logic.presetLetters'), value: 'letters' },
])

const applyPreset = (key: string | null): void => {
  const preset = key === null ? undefined : PRESET_TREES[key]
  if (preset === undefined) return
  override.value = 'visual'
  emitTree(structuredClone(preset))
}
</script>

<template>
  <div class="condition-builder" :data-testid="`condition-builder-${field}`">
    <div class="builder-header">
      <span v-tooltip.top="canVisual ? undefined : t('properties.logic.rawOnlyNote')">
        <SelectButton
          :model-value="mode"
          :options="modeOptions"
          option-label="label"
          option-value="value"
          option-disabled="disabled"
          :allow-empty="false"
          size="small"
          :aria-label="t('properties.logic.modeLabel')"
          :data-testid="`logic-mode-${field}`"
          @update:model-value="setMode"
        />
      </span>
      <Select
        v-if="field === 'constraint'"
        class="builder-presets"
        size="small"
        :model-value="null"
        :options="presetOptions"
        option-label="label"
        option-value="value"
        :placeholder="t('properties.logic.presets')"
        data-testid="constraint-presets"
        @update:model-value="applyPreset"
      />
    </div>

    <template v-if="mode === 'raw'">
      <ExpressionInput
        :model-value="modelValue"
        :field="field"
        :node-id="node.id"
        :placeholder="placeholder"
        @update:model-value="onRawEdit"
      />
      <small v-if="!canVisual" class="builder-note" :data-testid="`logic-raw-note-${field}`">
        {{ t('properties.logic.rawOnlyNote') }}
      </small>
    </template>

    <div v-else class="builder-visual" :data-testid="`logic-visual-${field}`">
      <SelectButton
        v-if="tree.items.length > 1"
        class="builder-join"
        :model-value="tree.join"
        :options="joinOptions"
        option-label="label"
        option-value="value"
        :allow-empty="false"
        size="small"
        :aria-label="t('properties.logic.joinLabel')"
        :data-testid="`cond-join-${field}`"
        @update:model-value="setJoin($event)"
      />

      <template v-for="(item, i) in tree.items" :key="i">
        <div
          v-if="item.kind === 'group'"
          class="cond-group"
          :data-testid="`cond-group-${field}-${i}`"
        >
          <SelectButton
            v-if="item.items.length > 1"
            class="builder-join"
            :model-value="item.join"
            :options="joinOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            size="small"
            :aria-label="t('properties.logic.joinLabel')"
            :data-testid="`cond-join-${field}-${i}`"
            @update:model-value="setJoin($event, i)"
          />
          <template v-for="(sub, j) in item.items" :key="j">
            <ConditionRow
              v-if="sub.kind !== 'group'"
              :condition="sub"
              :fields="fields"
              :self-option="selfOption"
              :testid="`cond-${field}-${i}-${j}`"
              @update:condition="updateAt([i, j], $event)"
              @remove="removeAt([i, j])"
            />
          </template>
          <Button
            :label="t('properties.logic.addCondition')"
            icon="pi pi-plus"
            text
            size="small"
            :disabled="!canSeed"
            :data-testid="`cond-add-${field}-${i}`"
            @click="addCondition(i)"
          />
        </div>
        <ConditionRow
          v-else
          :condition="item"
          :fields="fields"
          :self-option="selfOption"
          :testid="`cond-${field}-${i}`"
          @update:condition="updateAt([i], $event)"
          @remove="removeAt([i])"
        />
      </template>

      <p v-if="tree.items.length === 0" class="builder-empty">
        {{ t('properties.logic.emptyVisual') }}
      </p>

      <div class="builder-actions">
        <Button
          :label="t('properties.logic.addCondition')"
          icon="pi pi-plus"
          text
          size="small"
          :disabled="!canSeed"
          :data-testid="`cond-add-${field}`"
          @click="addCondition()"
        />
        <Button
          :label="t('properties.logic.addGroup')"
          icon="pi pi-clone"
          text
          size="small"
          severity="secondary"
          :disabled="!canSeed"
          :data-testid="`cond-add-group-${field}`"
          @click="addGroup"
        />
      </div>

      <small
        v-if="unrepresentable"
        class="builder-note builder-warning"
        :data-testid="`logic-unrepresentable-${field}`"
      >
        {{ t('properties.logic.unrepresentable') }}
      </small>
    </div>
  </div>
</template>

<style scoped>
.condition-builder {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.builder-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--odk-spacing-s);
  flex-wrap: wrap;
}

.builder-presets {
  flex: 1 1 auto;
  min-width: 0;
}

.builder-visual {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.builder-join {
  align-self: flex-start;
}

.cond-group {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
  padding: var(--odk-spacing-s);
  border: 1px dashed var(--odk-border-color);
  border-radius: var(--odk-radius);
}

.builder-empty {
  margin: 0;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.builder-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--odk-spacing-s);
}

.builder-note {
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.builder-warning {
  color: var(--odk-warning-text-color);
}
</style>
