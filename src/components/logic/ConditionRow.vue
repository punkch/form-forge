<script setup lang="ts">
// One row of the visual condition builder: field / operator / value.
// The operator list adapts to the field's bind type; the value widget adapts
// to both (dates get a picker, internal-list selects get a choice dropdown,
// numbers get a numeric input). An unresolvable field name degrades to plain
// text inputs — it never forces the whole tree back to raw mode.
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed } from 'vue'

import { defaultLiteral, isNumericField, type LogicFieldOption } from '@/components/logic/field-options'
import type { ComparisonOp, Condition, Operand } from '@/core/expr/structured'
import { displayText } from '@/core/model/display'
import { useAppI18n } from '@/i18n'
import { useFormStore } from '@/stores/form'

const props = defineProps<{
  condition: Condition
  /** Referenceable form fields, in document order. */
  fields: LogicFieldOption[]
  /** Metadata for the `.` operand; null when self is not offered (relevant). */
  selfOption: LogicFieldOption | null
  testid: string
}>()

const emit = defineEmits<{ 'update:condition': [Condition], remove: [] }>()

const { t } = useAppI18n()
const form = useFormStore()

const COMPARISONS: ComparisonOp[] = ['=', '!=', '<', '<=', '>', '>=']
type RowOpValue = ComparisonOp | `len${ComparisonOp}` | 'includes' | 'excludes' | 'matches'

const ORDERED_TYPES = new Set(['int', 'decimal', 'date', 'time', 'dateTime'])

// --- Field ------------------------------------------------------------

const fieldValue = computed(() =>
  props.condition.operand.type === 'self' ? '.' : props.condition.operand.name)

const currentOption = computed<LogicFieldOption | undefined>(() => {
  if (props.condition.operand.type === 'self') return props.selfOption ?? undefined
  const name = props.condition.operand.name
  return props.fields.find((f) => f.name === name)
})

const fieldSelectOptions = computed<LogicFieldOption[]>(() => {
  const options = props.selfOption === null ? [...props.fields] : [props.selfOption, ...props.fields]
  // Keep unresolvable operands visible (degrade, never destroy).
  if (currentOption.value === undefined) {
    options.unshift({ name: fieldValue.value, label: fieldValue.value, bindType: 'string' })
  }
  return options
})

// --- Operator ---------------------------------------------------------

const rowOp = computed<RowOpValue>(() => {
  const c = props.condition
  if (c.kind === 'comparison') return c.op
  if (c.kind === 'selected') return c.negated ? 'excludes' : 'includes'
  if (c.kind === 'string-length') return `len${c.op}`
  return 'matches'
})

const rowOpLabel = (value: RowOpValue): string => {
  if (value === 'includes') return t('properties.logic.opSelected')
  if (value === 'excludes') return t('properties.logic.opNotSelected')
  if (value === 'matches') return t('properties.logic.opMatches')
  if (value.startsWith('len')) return t('properties.logic.opLength', { op: value.slice(3) })
  return value
}

const opOptions = computed<Array<{ label: string, value: RowOpValue }>>(() => {
  const option = currentOption.value
  const values: RowOpValue[] = []
  if (option?.listRef !== undefined) {
    values.push('includes', 'excludes', '=', '!=')
  } else if (option !== undefined && ORDERED_TYPES.has(option.bindType)) {
    values.push(...COMPARISONS)
  } else {
    values.push(...COMPARISONS)
    values.push(...COMPARISONS.map((op): RowOpValue => `len${op}`))
    values.push('matches')
  }
  if (!values.includes(rowOp.value)) values.unshift(rowOp.value)
  return values.map((value) => ({ label: rowOpLabel(value), value }))
})

// --- Value ------------------------------------------------------------

const literalValue = computed<number | string>(() => {
  const c = props.condition
  if (c.kind === 'comparison') return c.literal
  if (c.kind === 'selected') return c.value
  if (c.kind === 'string-length') return c.value
  return c.pattern
})

const choiceOptions = computed<Array<{ label: string, value: string }>>(() => {
  const listRef = currentOption.value?.listRef
  const list = listRef !== undefined ? form.doc?.choiceLists[listRef] : undefined
  return (list?.choices ?? []).map((c) => {
    const label = displayText(c.label)
    return { label: label === '' ? c.name : `${label} (${c.name})`, value: c.name }
  })
})

type ValueWidget = 'text' | 'int' | 'number' | 'date' | 'choices'

const valueWidget = computed<ValueWidget>(() => {
  const c = props.condition
  if (c.kind === 'regex') return 'text'
  if (c.kind === 'string-length') return 'int'
  if (c.kind === 'selected') return choiceOptions.value.length > 0 ? 'choices' : 'text'
  const option = currentOption.value
  if (option === undefined) return 'text'
  if (option.listRef !== undefined && choiceOptions.value.length > 0) return 'choices'
  if (option.bindType === 'int') return 'int'
  if (option.bindType === 'decimal') return 'number'
  if (option.bindType === 'date') return 'date'
  return 'text'
})

const dateValue = computed<Date | null>(() => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(literalValue.value))
  if (match === null) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
})

// --- Updates ----------------------------------------------------------

/** Rebuild the condition for a (possibly new) operator, keeping what fits. */
const buildCondition = (
  operand: Operand,
  op: RowOpValue,
  option: LogicFieldOption | undefined
): Condition => {
  const prior = props.condition
  if (op === 'includes' || op === 'excludes') {
    const value = prior.kind === 'selected'
      ? prior.value
      : prior.kind === 'comparison' && typeof prior.literal === 'string' ? prior.literal : ''
    return { kind: 'selected', operand, value, negated: op === 'excludes' }
  }
  if (op === 'matches') {
    return { kind: 'regex', operand, pattern: prior.kind === 'regex' ? prior.pattern : '' }
  }
  if (op === 'len=' || op === 'len!=' || op === 'len<' || op === 'len<=' || op === 'len>' || op === 'len>=') {
    return {
      kind: 'string-length',
      operand,
      op: op.slice(3) as ComparisonOp,
      value: prior.kind === 'string-length' ? prior.value : 0,
    }
  }
  let literal: number | string
  if (prior.kind === 'comparison') literal = prior.literal
  else if (prior.kind === 'selected') literal = prior.value
  else literal = defaultLiteral(option)
  // Keep the literal only when its type matches what the value widget edits.
  const wantsNumber = isNumericField(option)
  if (wantsNumber && typeof literal !== 'number') literal = 0
  if (!wantsNumber && option !== undefined && typeof literal === 'number') literal = String(literal)
  return { kind: 'comparison', operand, op, literal }
}

const setField = (name: string | null): void => {
  if (name === null) return
  const operand: Operand = name === '.' ? { type: 'self' } : { type: 'field', name }
  const option = name === '.'
    ? props.selfOption ?? undefined
    : props.fields.find((f) => f.name === name)
  // Keep the operator when the new field supports it; fall back to '='.
  let op = rowOp.value
  const selectable = option?.listRef !== undefined
  if ((op === 'includes' || op === 'excludes') && !selectable) op = '='
  if ((op === 'matches' || op.startsWith('len')) && option !== undefined && ORDERED_TYPES.has(option.bindType)) op = '='
  emit('update:condition', buildCondition(operand, op, option))
}

const setOp = (op: RowOpValue | null): void => {
  if (op === null) return
  emit('update:condition', buildCondition(props.condition.operand, op, currentOption.value))
}

const emitValue = (value: number | string): void => {
  const c = props.condition
  if (c.kind === 'comparison') emit('update:condition', { ...c, literal: value })
  else if (c.kind === 'selected') emit('update:condition', { ...c, value: String(value) })
  else if (c.kind === 'string-length') emit('update:condition', { ...c, value: typeof value === 'number' ? value : 0 })
  else emit('update:condition', { ...c, pattern: String(value) })
}

const setTextValue = (value: string | undefined): void => {
  const text = value ?? ''
  // Unresolvable fields degrade to a text input; keep numeric-looking input
  // numeric there so e.g. `${x} > 5` survives edits while `x` is missing.
  if (
    props.condition.kind === 'comparison' &&
    currentOption.value === undefined &&
    /^-?\d+(\.\d+)?$/.test(text)
  ) {
    emitValue(Number(text))
    return
  }
  emitValue(text)
}

const setNumberValue = (value: number | null): void => { emitValue(value ?? 0) }

const setDateValue = (value: unknown): void => {
  if (!(value instanceof Date)) {
    emitValue('')
    return
  }
  const pad = (n: number): string => String(n).padStart(2, '0')
  emitValue(`${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`)
}
</script>

<template>
  <div class="cond-row" :data-testid="testid">
    <Select
      class="cond-field"
      size="small"
      :model-value="fieldValue"
      :options="fieldSelectOptions"
      option-label="label"
      option-value="name"
      :aria-label="t('properties.logic.fieldLabel')"
      :data-testid="`${testid}-field`"
      @update:model-value="setField"
    />
    <Select
      class="cond-op"
      size="small"
      :model-value="rowOp"
      :options="opOptions"
      option-label="label"
      option-value="value"
      :aria-label="t('properties.logic.operatorLabel')"
      :data-testid="`${testid}-op`"
      @update:model-value="setOp"
    />
    <Select
      v-if="valueWidget === 'choices'"
      class="cond-value"
      size="small"
      :model-value="String(literalValue)"
      :options="choiceOptions"
      option-label="label"
      option-value="value"
      :aria-label="t('properties.logic.valueLabel')"
      :data-testid="`${testid}-value`"
      @update:model-value="emitValue(String($event ?? ''))"
    />
    <InputNumber
      v-else-if="valueWidget === 'int' || valueWidget === 'number'"
      class="cond-value"
      size="small"
      :model-value="typeof literalValue === 'number' ? literalValue : null"
      :max-fraction-digits="valueWidget === 'number' ? 10 : 0"
      :use-grouping="false"
      :aria-label="t('properties.logic.valueLabel')"
      :data-testid="`${testid}-value`"
      @update:model-value="setNumberValue"
    />
    <DatePicker
      v-else-if="valueWidget === 'date'"
      class="cond-value"
      size="small"
      date-format="yy-mm-dd"
      :model-value="dateValue"
      :aria-label="t('properties.logic.valueLabel')"
      :data-testid="`${testid}-value`"
      @update:model-value="setDateValue"
    />
    <InputText
      v-else
      class="cond-value"
      size="small"
      :model-value="String(literalValue)"
      :placeholder="condition.kind === 'regex' ? t('properties.logic.patternPlaceholder') : undefined"
      :aria-label="t('properties.logic.valueLabel')"
      :data-testid="`${testid}-value`"
      @update:model-value="setTextValue"
    />
    <Button
      class="cond-remove"
      icon="pi pi-times"
      text
      rounded
      size="small"
      severity="secondary"
      :aria-label="t('properties.logic.removeCondition')"
      :data-testid="`${testid}-remove`"
      @click="emit('remove')"
    />
  </div>
</template>

<style scoped>
.cond-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--odk-spacing-s);
}

.cond-field {
  flex: 1 1 100%;
  min-width: 0;
}

.cond-op {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 45%;
}

.cond-value {
  flex: 1 1 30%;
  min-width: 0;
}

.cond-value :deep(input) {
  width: 100%;
  min-width: 0;
}

.cond-remove {
  flex: 0 0 auto;
}
</style>
