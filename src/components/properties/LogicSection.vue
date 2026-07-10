<script setup lang="ts">
import { computed, ref } from 'vue'

import HelpPopover from '@/components/help/HelpPopover.vue'
import CalculationHelper from '@/components/logic/CalculationHelper.vue'
import ConditionBuilder from '@/components/logic/ConditionBuilder.vue'
import ExpressionInput from '@/components/properties/ExpressionInput.vue'
import LocalizedInput from '@/components/properties/LocalizedInput.vue'
import { setText } from '@/core/model/display'
import type { FormNode, Lang } from '@/core/model/types'
import { getQuestionType } from '@/core/registry/question-types'
import { hasText } from '@/core/util/guards'
import { useAppI18n } from '@/i18n'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ node: FormNode }>()

const { t } = useAppI18n()
const form = useFormStore()

/** The calculation ExpressionInput, so CalculationHelper can insert at its caret. */
const calcInput = ref<InstanceType<typeof ExpressionInput> | null>(null)
const calcCaret = (): { start: number, end: number } | null => calcInput.value?.getCaret() ?? null

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

// Validation messages write the language the input displayed (LocalizedInput emits it).
const setConstraintMessage = (value: string, lang: Lang): void => {
  form.updateNode(props.node.id, t('properties.logic.undoEditConstraintMessage'), (n) => {
    n.bind.constraintMessage = setText(n.bind.constraintMessage, value, lang)
  })
}

const setRequiredMessage = (value: string, lang: Lang): void => {
  form.updateNode(props.node.id, t('properties.logic.undoEditRequiredMessage'), (n) => {
    n.bind.requiredMessage = setText(n.bind.requiredMessage, value, lang)
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
    <div v-if="!isMeta" class="prop-field">
      <span>{{ t('properties.logic.relevant') }}<HelpPopover field="relevant" /></span>
      <ConditionBuilder
        :model-value="node.bind.relevant ?? ''"
        field="relevant"
        :node="node"
        :placeholder="t('properties.logic.relevantPlaceholder')"
        @update:model-value="setExpr('relevant', t('properties.logic.undoEditRelevant'))($event)"
      />
    </div>

    <div v-if="node.kind === 'question' && !isMeta" class="prop-field">
      <span>{{ t('properties.logic.constraint') }}<HelpPopover field="constraint" /></span>
      <ConditionBuilder
        :model-value="node.bind.constraint ?? ''"
        field="constraint"
        :node="node"
        :placeholder="t('properties.logic.constraintPlaceholder')"
        @update:model-value="setExpr('constraint', t('properties.logic.undoEditConstraint'))($event)"
      />
    </div>

    <label v-if="hasText(node.bind.constraint)" class="prop-field">
      <span>{{ t('properties.logic.constraintMessage') }}<HelpPopover field="constraintMessage" /></span>
      <LocalizedInput
        :value="node.bind.constraintMessage"
        data-testid="prop-constraint-message"
        @edit="setConstraintMessage"
      />
    </label>

    <label v-if="hasText(node.bind.required)" class="prop-field">
      <span>{{ t('properties.logic.requiredMessage') }}<HelpPopover field="requiredMessage" /></span>
      <LocalizedInput
        :value="node.bind.requiredMessage"
        data-testid="prop-required-message"
        @edit="setRequiredMessage"
      />
    </label>

    <div v-if="node.kind === 'question' && (isCalculate || !isMeta)" class="prop-field">
      <span>{{ t('properties.logic.calculation') }}<HelpPopover field="calculation" /></span>
      <ExpressionInput
        ref="calcInput"
        :model-value="node.bind.calculation ?? ''"
        field="calculation"
        :node-id="node.id"
        :placeholder="t('properties.logic.calculationPlaceholder')"
        @update:model-value="setExpr('calculation', t('properties.logic.undoEditCalculation'))($event)"
      />
      <CalculationHelper
        :model-value="node.bind.calculation ?? ''"
        :node="node"
        :get-caret="calcCaret"
        @update:model-value="setExpr('calculation', t('properties.logic.undoEditCalculation'))($event)"
      />
    </div>

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
