<script lang="ts">
import type { QuestionTypeDefinition } from '@/core/registry/question-types'

/** Whether this section will render anything for the given type definition. */
export const hasTypeConfig = (def: QuestionTypeDefinition | undefined): boolean =>
  def !== undefined &&
  ((def.appearances?.length ?? 0) > 0 || (def.parameters?.length ?? 0) > 0 || def.requiresFile === true)
</script>

<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed } from 'vue'

import type { FormNode } from '@/core/model/types'
import { getQuestionType, type QuestionTypeParameter } from '@/core/registry/question-types'
import { useAppI18n } from '@/i18n'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ node: FormNode }>()

const { t } = useAppI18n()
const form = useFormStore()

const def = computed(() => getQuestionType(props.node.kind === 'question' ? props.node.type : props.node.kind))

const appearanceOptions = computed(() =>
  (def.value?.appearances ?? []).map((a) => ({
    label: a.enketoSupported ? a.name : t('properties.typeConfig.collectOnly', { name: a.name }),
    value: a.name,
  }))
)

const setAppearance = (value: string | null): void => {
  form.updateNode(props.node.id, t('properties.typeConfig.undoEditAppearance'), (n) => {
    n.body.appearance = value === null || value === '' ? undefined : value
  })
}

const setParameter = (param: QuestionTypeParameter, value: string | undefined): void => {
  form.updateNode(props.node.id, t('properties.typeConfig.undoEditParameter', { name: param.name }), (n) => {
    const params = { ...n.body.parameters }
    if (value === undefined || value === '') delete params[param.name]
    else params[param.name] = value
    n.body.parameters = Object.keys(params).length > 0 ? params : undefined
  })
}

const paramValue = (param: QuestionTypeParameter): string =>
  props.node.body.parameters?.[param.name] ?? ''

/** Display-only sentence casing ("thousands-sep" → "Thousands sep"); keys stay verbatim. */
const paramLabel = (name: string): string => {
  const spaced = name.replace(/-/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const setItemsetFile = (value: string): void => {
  form.updateNode(props.node.id, t('properties.typeConfig.undoEditChoicesFile'), (n) => {
    if (n.kind === 'question') n.itemsetFile = value === '' ? undefined : value
  })
}
</script>

<template>
  <section v-if="def && hasTypeConfig(def)" class="prop-section">
    <label v-if="(def.appearances?.length ?? 0) > 0" class="prop-field">
      <span>{{ t('properties.typeConfig.appearance') }}</span>
      <Select
        :model-value="node.body.appearance ?? null"
        :options="appearanceOptions"
        option-label="label"
        option-value="value"
        editable
        show-clear
        :placeholder="t('properties.typeConfig.appearancePlaceholder')"
        data-testid="prop-appearance"
        @update:model-value="setAppearance"
      />
    </label>

    <label v-if="def.requiresFile && node.kind === 'question'" class="prop-field">
      <span>{{ t('properties.typeConfig.choicesFile') }}</span>
      <InputText
        :model-value="node.itemsetFile ?? ''"
        :placeholder="t('properties.typeConfig.choicesFilePlaceholder')"
        data-testid="prop-itemset-file"
        @update:model-value="setItemsetFile($event ?? '')"
      />
    </label>

    <template v-for="param in def.parameters ?? []" :key="param.name">
      <label v-if="param.type === 'boolean'" class="prop-toggle">
        <Checkbox
          :model-value="paramValue(param) === 'true'"
          binary
          :data-testid="`prop-param-${param.name}`"
          @update:model-value="setParameter(param, $event === true ? 'true' : undefined)"
        />
        <span v-tooltip.left="param.description">{{ paramLabel(param.name) }}</span>
      </label>
      <label v-else class="prop-field">
        <span v-tooltip.left="param.description">{{ paramLabel(param.name) }}<template v-if="param.required"> *</template></span>
        <Select
          v-if="param.options"
          :model-value="paramValue(param) === '' ? null : paramValue(param)"
          :options="param.options"
          show-clear
          :placeholder="String(param.defaultValue ?? '')"
          :data-testid="`prop-param-${param.name}`"
          @update:model-value="setParameter(param, $event ?? undefined)"
        />
        <InputText
          v-else
          :model-value="paramValue(param)"
          :placeholder="param.defaultValue !== undefined ? String(param.defaultValue) : ''"
          :data-testid="`prop-param-${param.name}`"
          @update:model-value="setParameter(param, $event ?? undefined)"
        />
      </label>
    </template>
  </section>
</template>

<style scoped>
@import './prop-section.css';
</style>
