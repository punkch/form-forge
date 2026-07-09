<script setup lang="ts">
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed } from 'vue'

import { displayText, setText } from '@/core/model/display'
import { DEFAULT_LANG, type FormNode } from '@/core/model/types'
import { getQuestionType } from '@/core/registry/question-types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ node: FormNode }>()

const form = useFormStore()
const editor = useEditorStore()

// Label/hint edits target the editor's display language (default otherwise).
const editLang = computed(() => editor.displayLanguage ?? DEFAULT_LANG)

const def = computed(() => getQuestionType(props.node.kind === 'question' ? props.node.type : props.node.kind))
const isMeta = computed(() => def.value?.category === 'meta')
const isCalculate = computed(() => props.node.kind === 'question' && props.node.type === 'calculate')
const showLabel = computed(() => !isMeta.value && !isCalculate.value)

const nameIssues = computed(() =>
  (form.issuesByNode.get(props.node.id) ?? []).filter((i) => i.code.startsWith('name.'))
)

const setLabel = (value: string): void => {
  form.updateNode(props.node.id, 'Edit label', (n) => { n.label = setText(n.label, value, editLang.value) })
}

const setName = (value: string): void => {
  form.updateNode(props.node.id, 'Edit name', (n) => { n.name = value })
}

const setHint = (value: string): void => {
  form.updateNode(props.node.id, 'Edit hint', (n) => { n.hint = setText(n.hint, value, editLang.value) })
}

const setDefault = (value: string): void => {
  form.updateNode(props.node.id, 'Edit default', (n) => {
    n.defaultValue = value === '' ? undefined : value
  })
}

const setRequired = (value: boolean): void => {
  form.updateNode(props.node.id, 'Toggle required', (n) => {
    n.bind.required = value ? 'true()' : undefined
  })
}

const setReadonly = (value: boolean): void => {
  form.updateNode(props.node.id, 'Toggle read only', (n) => {
    n.bind.readonly = value ? 'true()' : undefined
  })
}
</script>

<template>
  <section class="prop-section">
    <label v-if="showLabel" class="prop-field">
      <span>Label</span>
      <Textarea
        :model-value="displayText(node.label, editor.displayLanguage ?? undefined)"
        auto-resize
        rows="1"
        data-testid="prop-label"
        @update:model-value="setLabel($event ?? '')"
      />
    </label>

    <label class="prop-field">
      <span>Name</span>
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
      <span>Hint</span>
      <InputText
        :model-value="displayText(node.hint, editor.displayLanguage ?? undefined)"
        data-testid="prop-hint"
        @update:model-value="setHint($event ?? '')"
      />
    </label>

    <label v-if="node.kind === 'question' && !isMeta" class="prop-field">
      <span>Default value</span>
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
        <span>Required</span>
      </label>
      <label class="prop-toggle">
        <ToggleSwitch
          :model-value="node.bind.readonly !== undefined"
          data-testid="prop-readonly"
          @update:model-value="setReadonly"
        />
        <span>Read only</span>
      </label>
    </div>
  </section>
</template>

<style scoped>
@import './prop-section.css';
</style>
