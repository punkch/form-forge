<script setup lang="ts">
import InputText from 'primevue/inputtext'
import { computed } from 'vue'

import HelpPopover from '@/components/help/HelpPopover.vue'
import ExpressionInput from '@/components/properties/ExpressionInput.vue'
import { displayText, setText } from '@/core/model/display'
import type { FormNode } from '@/core/model/types'
import { getQuestionType } from '@/core/registry/question-types'
import { useAppI18n } from '@/i18n'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ node: FormNode }>()

const { t } = useAppI18n()
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
  form.updateNode(props.node.id, t('properties.logic.undoEditConstraintMessage'), (n) => {
    n.bind.constraintMessage = setText(n.bind.constraintMessage, value)
  })
}

const setRepeatCount = (value: string): void => {
  form.updateNode(props.node.id, t('properties.logic.undoEditRepeatCount'), (n) => {
    if (n.kind === 'repeat') n.repeatCount = value === '' ? undefined : value
  })
}
</script>

<template>
  <section class="prop-section">
    <label v-if="!isMeta" class="prop-field">
      <span>{{ t('properties.logic.relevant') }}<HelpPopover field="relevant" /></span>
      <ExpressionInput
        :model-value="node.bind.relevant ?? ''"
        field="relevant"
        :node-id="node.id"
        :placeholder="t('properties.logic.relevantPlaceholder')"
        @update:model-value="setExpr('relevant', t('properties.logic.undoEditRelevant'))($event)"
      />
    </label>

    <label v-if="node.kind === 'question' && !isMeta" class="prop-field">
      <span>{{ t('properties.logic.constraint') }}<HelpPopover field="constraint" /></span>
      <ExpressionInput
        :model-value="node.bind.constraint ?? ''"
        field="constraint"
        :node-id="node.id"
        :placeholder="t('properties.logic.constraintPlaceholder')"
        @update:model-value="setExpr('constraint', t('properties.logic.undoEditConstraint'))($event)"
      />
    </label>

    <label v-if="node.bind.constraint" class="prop-field">
      <span>{{ t('properties.logic.constraintMessage') }}<HelpPopover field="constraintMessage" /></span>
      <InputText
        :model-value="displayText(node.bind.constraintMessage)"
        data-testid="prop-constraint-message"
        @update:model-value="setConstraintMessage($event ?? '')"
      />
    </label>

    <label v-if="node.kind === 'question' && (isCalculate || !isMeta)" class="prop-field">
      <span>{{ t('properties.logic.calculation') }}<HelpPopover field="calculation" /></span>
      <ExpressionInput
        :model-value="node.bind.calculation ?? ''"
        field="calculation"
        :node-id="node.id"
        :placeholder="t('properties.logic.calculationPlaceholder')"
        @update:model-value="setExpr('calculation', t('properties.logic.undoEditCalculation'))($event)"
      />
    </label>

    <label v-if="node.kind === 'repeat'" class="prop-field">
      <span>{{ t('properties.logic.repeatCount') }}<HelpPopover field="repeatCount" /></span>
      <ExpressionInput
        :model-value="node.repeatCount ?? ''"
        field="repeatCount"
        :node-id="node.id"
        :placeholder="t('properties.logic.repeatCountPlaceholder')"
        @update:model-value="setRepeatCount"
      />
    </label>
  </section>
</template>

<style scoped>
@import './prop-section.css';
</style>
