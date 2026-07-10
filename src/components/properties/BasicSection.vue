<script setup lang="ts">
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed } from 'vue'

import HelpPopover from '@/components/help/HelpPopover.vue'
import LocalizedInput from '@/components/properties/LocalizedInput.vue'
import { setText } from '@/core/model/display'
import type { FormNode, Lang } from '@/core/model/types'
import { getQuestionType } from '@/core/registry/question-types'
import { useAppI18n } from '@/i18n'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ node: FormNode }>()

const { t } = useAppI18n()
const form = useFormStore()

const def = computed(() => getQuestionType(props.node.kind === 'question' ? props.node.type : props.node.kind))
const isMeta = computed(() => def.value?.category === 'meta')
const isCalculate = computed(() => props.node.kind === 'question' && props.node.type === 'calculate')
const showLabel = computed(() => !isMeta.value && !isCalculate.value)

const nameIssues = computed(() =>
  (form.issuesByNode.get(props.node.id) ?? []).filter((i) => i.code.startsWith('name.'))
)

// Localized edits write the language the input displayed (LocalizedInput emits it).
const setLabel = (value: string, lang: Lang): void => {
  form.updateNode(props.node.id, t('properties.basic.undoEditLabel'), (n) => { n.label = setText(n.label, value, lang) })
}

const setName = (value: string): void => {
  form.updateNode(props.node.id, t('properties.basic.undoEditName'), (n) => { n.name = value })
}

const setHint = (value: string, lang: Lang): void => {
  form.updateNode(props.node.id, t('properties.basic.undoEditHint'), (n) => { n.hint = setText(n.hint, value, lang) })
}

const setGuidanceHint = (value: string, lang: Lang): void => {
  form.updateNode(props.node.id, t('properties.basic.undoEditGuidanceHint'), (n) => {
    n.guidanceHint = setText(n.guidanceHint, value, lang)
  })
}

const setDefault = (value: string): void => {
  form.updateNode(props.node.id, t('properties.basic.undoEditDefault'), (n) => {
    n.defaultValue = value === '' ? undefined : value
  })
}

const setRequired = (value: boolean): void => {
  form.updateNode(props.node.id, t('properties.basic.undoToggleRequired'), (n) => {
    n.bind.required = value ? 'true()' : undefined
  })
}

const setReadonly = (value: boolean): void => {
  form.updateNode(props.node.id, t('properties.basic.undoToggleReadOnly'), (n) => {
    n.bind.readonly = value ? 'true()' : undefined
  })
}
</script>

<template>
  <section class="prop-section">
    <label v-if="showLabel" class="prop-field">
      <span>{{ t('properties.basic.label') }}<HelpPopover field="label" /></span>
      <LocalizedInput
        :value="node.label"
        multiline
        data-testid="prop-label"
        @edit="setLabel"
      />
    </label>

    <label class="prop-field">
      <span>{{ t('properties.basic.name') }}<HelpPopover field="name" /></span>
      <InputText
        :model-value="node.name"
        :invalid="nameIssues.length > 0"
        class="prop-name-input"
        data-testid="prop-name"
        @update:model-value="setName($event ?? '')"
      />
      <small v-for="(issue, i) in nameIssues" :key="i" class="prop-issue">{{ issue.message }}</small>
    </label>

    <label v-if="showLabel" class="prop-field">
      <span>{{ t('properties.basic.hint') }}<HelpPopover field="hint" /></span>
      <LocalizedInput
        :value="node.hint"
        data-testid="prop-hint"
        @edit="setHint"
      />
    </label>

    <label v-if="showLabel" class="prop-field">
      <span>{{ t('properties.basic.guidanceHint') }}<HelpPopover field="guidanceHint" /></span>
      <LocalizedInput
        :value="node.guidanceHint"
        data-testid="prop-guidance-hint"
        @edit="setGuidanceHint"
      />
    </label>

    <label v-if="node.kind === 'question' && !isMeta" class="prop-field">
      <span>{{ t('properties.basic.defaultValue') }}<HelpPopover field="defaultValue" /></span>
      <InputText
        :model-value="node.defaultValue ?? ''"
        data-testid="prop-default"
        @update:model-value="setDefault($event ?? '')"
      />
    </label>

    <div v-if="node.kind === 'question' && !isMeta && !isCalculate" class="prop-toggles">
      <label class="prop-toggle">
        <ToggleSwitch
          :model-value="node.bind.required !== undefined"
          data-testid="prop-required"
          @update:model-value="setRequired"
        />
        <span>{{ t('properties.basic.required') }}<HelpPopover field="required" /></span>
      </label>
      <label class="prop-toggle">
        <ToggleSwitch
          :model-value="node.bind.readonly !== undefined"
          data-testid="prop-readonly"
          @update:model-value="setReadonly"
        />
        <span>{{ t('properties.basic.readOnly') }}<HelpPopover field="readOnly" /></span>
      </label>
    </div>
  </section>
</template>

<style scoped>
@import './prop-section.css';
</style>
