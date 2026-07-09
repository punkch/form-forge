<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed } from 'vue'

import ExpressionInput from '@/components/properties/ExpressionInput.vue'
import { displayText, setText } from '@/core/model/display'
import type { FormNode } from '@/core/model/types'
import { getQuestionType } from '@/core/registry/question-types'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ node: FormNode }>()

const form = useFormStore()

const isCalculate = computed(() => props.node.kind === 'question' && props.node.type === 'calculate')
const isMeta = computed(() => {
  const def = getQuestionType(props.node.kind === 'question' ? props.node.type : props.node.kind)
  return def?.category === 'meta'
})

const setExpr = (
  key: 'relevant' | 'constraint' | 'calculation',
  label: string
) => (value: string): void => {
  form.updateNode(props.node.id, label, (n) => {
    n.bind[key] = value === '' ? undefined : value
  })
}

const setConstraintMessage = (value: string): void => {
  form.updateNode(props.node.id, 'Edit constraint message', (n) => {
    n.bind.constraintMessage = setText(n.bind.constraintMessage, value)
  })
}

const setRepeatCount = (value: string): void => {
  form.updateNode(props.node.id, 'Edit repeat count', (n) => {
    if (n.kind === 'repeat') n.repeatCount = value === '' ? undefined : value
  })
}
</script>

<template>
  <section class="prop-section">
    <label v-if="!isMeta" class="prop-field">
      <span>Relevant (skip logic)</span>
      <ExpressionInput
        :model-value="node.bind.relevant ?? ''"
        field="relevant"
        :node-id="node.id"
        placeholder="e.g. ${age} >= 18"
        @update:model-value="setExpr('relevant', 'Edit relevant')($event)"
      />
    </label>

    <label v-if="node.kind === 'question' && !isMeta" class="prop-field">
      <span>Constraint</span>
      <ExpressionInput
        :model-value="node.bind.constraint ?? ''"
        field="constraint"
        :node-id="node.id"
        placeholder="e.g. . >= 0 and . <= 120"
        @update:model-value="setExpr('constraint', 'Edit constraint')($event)"
      />
    </label>

    <label v-if="node.bind.constraint" class="prop-field">
      <span>Constraint message</span>
      <InputText
        :model-value="displayText(node.bind.constraintMessage)"
        data-testid="prop-constraint-message"
        @update:model-value="setConstraintMessage($event ?? '')"
      />
    </label>

    <label v-if="node.kind === 'question' && (isCalculate || !isMeta)" class="prop-field">
      <span>Calculation</span>
      <ExpressionInput
        :model-value="node.bind.calculation ?? ''"
        field="calculation"
        :node-id="node.id"
        placeholder="e.g. ${price} * ${quantity}"
        @update:model-value="setExpr('calculation', 'Edit calculation')($event)"
      />
    </label>

    <label v-if="node.kind === 'repeat'" class="prop-field">
      <span>Repeat count</span>
      <ExpressionInput
        :model-value="node.repeatCount ?? ''"
        field="repeatCount"
        :node-id="node.id"
        placeholder="e.g. ${household_size}"
        @update:model-value="setRepeatCount"
      />
    </label>
  </section>
</template>

<style scoped>
@import './prop-section.css';
</style>
