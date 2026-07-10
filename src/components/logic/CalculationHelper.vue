<script setup lang="ts">
// Insert-only template picker for the calculation expression. Calculations
// stay expression-shaped (raw ExpressionInput); this helper drops a common
// formula skeleton — pre-filled with real field names from the form where
// possible — at the cursor of the calculation input (or replaces the current
// selection), then the author adjusts it with the usual ${} autocomplete.
import Select from 'primevue/select'
import { computed } from 'vue'

import { logicFieldOptions } from '@/components/logic/field-options'
import type { FormDocument, FormNode } from '@/core/model/types'
import { useAppI18n } from '@/i18n'
import { useFormStore } from '@/stores/form'

const props = defineProps<{
  modelValue: string
  node: FormNode
  /** Reads the calculation input's caret; null when it has never been focused. */
  getCaret?: () => { start: number, end: number } | null
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const { t } = useAppI18n()
const form = useFormStore()

const fields = computed(() =>
  form.doc === null ? [] : logicFieldOptions(form.doc as FormDocument, props.node.id))

/** First two field names matching `types`, padded with generic placeholders. */
const pick = (types: string[] | null): [string, string] => {
  const pool = types === null
    ? fields.value
    : fields.value.filter((f) => types.includes(f.bindType))
  const names = (pool.length > 0 ? pool : fields.value).map((f) => f.name)
  return [names[0] ?? 'field1', names[1] ?? names[0] ?? 'field2']
}

const templates = computed(() => {
  const [numA, numB] = pick(['int', 'decimal'])
  const [anyA, anyB] = pick(null)
  const [dateA, dateB] = pick(['date', 'dateTime'])
  return [
    { label: t('properties.logic.calcArithmetic'), value: `\${${numA}} + \${${numB}}` },
    { label: t('properties.logic.calcIf'), value: `if(\${${anyA}} = '', 'a', 'b')` },
    { label: t('properties.logic.calcConcat'), value: `concat(\${${anyA}}, ' ', \${${anyB}})` },
    {
      label: t('properties.logic.calcDateDiff'),
      value: `int(decimal-date-time(\${${dateB}}) - decimal-date-time(\${${dateA}}))`,
    },
  ]
})

/** Insert at the calculation input's caret / replace its selection; when the
 * input was never focused (no real caret), append after a separating space. */
const insertTemplate = (text: string | null): void => {
  if (text === null) return
  const current = props.modelValue
  if (current === '') {
    emit('update:modelValue', text)
    return
  }
  const caret = props.getCaret?.() ?? null
  if (caret === null) {
    emit('update:modelValue', `${current} ${text}`)
    return
  }
  emit('update:modelValue', current.slice(0, caret.start) + text + current.slice(caret.end))
}
</script>

<template>
  <Select
    class="calc-helper"
    size="small"
    :model-value="null"
    :options="templates"
    option-label="label"
    option-value="value"
    :placeholder="t('properties.logic.calcHelper')"
    data-testid="calc-helper"
    @update:model-value="insertTemplate"
  />
</template>

<style scoped>
.calc-helper {
  width: 100%;
}
</style>
