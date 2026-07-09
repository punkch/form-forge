<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed } from 'vue'

import type { FormNode } from '@/core/model/types'
import { getQuestionType, type QuestionTypeParameter } from '@/core/registry/question-types'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ node: FormNode }>()

const form = useFormStore()

const def = computed(() => getQuestionType(props.node.kind === 'question' ? props.node.type : props.node.kind))

const appearanceOptions = computed(() =>
  (def.value?.appearances ?? []).map((a) => ({
    label: a.enketoSupported ? a.name : `${a.name} (Collect only)`,
    value: a.name,
  }))
)

const setAppearance = (value: string | null): void => {
  form.updateNode(props.node.id, 'Edit appearance', (n) => {
    n.body.appearance = value === null || value === '' ? undefined : value
  })
}

const setParameter = (param: QuestionTypeParameter, value: string | undefined): void => {
  form.updateNode(props.node.id, `Edit ${param.name}`, (n) => {
    const params = { ...n.body.parameters }
    if (value === undefined || value === '') delete params[param.name]
    else params[param.name] = value
    n.body.parameters = Object.keys(params).length > 0 ? params : undefined
  })
}

const paramValue = (param: QuestionTypeParameter): string =>
  props.node.body.parameters?.[param.name] ?? ''

const setItemsetFile = (value: string): void => {
  form.updateNode(props.node.id, 'Edit choices file', (n) => {
    if (n.kind === 'question') n.itemsetFile = value === '' ? undefined : value
  })
}
</script>

<template>
  <section v-if="def && ((def.appearances?.length ?? 0) > 0 || (def.parameters?.length ?? 0) > 0 || def.requiresFile)" class="prop-section">
    <label v-if="(def.appearances?.length ?? 0) > 0" class="prop-field">
      <span>Appearance</span>
      <Select
        :model-value="node.body.appearance ?? null"
        :options="appearanceOptions"
        option-label="label"
        option-value="value"
        editable
        show-clear
        placeholder="default"
        data-testid="prop-appearance"
        @update:model-value="setAppearance"
      />
    </label>

    <label v-if="def.requiresFile && node.kind === 'question'" class="prop-field">
      <span>Choices file (csv / xml / geojson)</span>
      <InputText
        :model-value="node.itemsetFile ?? ''"
        placeholder="e.g. districts.csv"
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
        <span v-tooltip.left="param.description">{{ param.name }}</span>
      </label>
      <label v-else class="prop-field">
        <span v-tooltip.left="param.description">{{ param.name }}<template v-if="param.required"> *</template></span>
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
