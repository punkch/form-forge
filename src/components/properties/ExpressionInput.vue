<script setup lang="ts">
import Textarea from 'primevue/textarea'
import { computed, ref } from 'vue'

import { useFormStore } from '@/stores/form'

const props = defineProps<{
  modelValue: string
  /** Expression property name — used to surface matching validation issues. */
  field: string
  nodeId: string
  placeholder?: string
  inputId?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const form = useFormStore()
const textareaRef = ref<{ $el: HTMLTextAreaElement } | null>(null)
const suggestionsOpen = ref(false)
const highlighted = ref(0)

/** The partial name being typed after an unclosed `${`. */
const pendingRef = computed<string | null>(() => {
  const el = textareaRef.value?.$el
  if (el === undefined || el === null || !suggestionsOpen.value) return null
  const upToCursor = props.modelValue.slice(0, el.selectionStart ?? props.modelValue.length)
  const match = upToCursor.match(/\$\{([A-Za-z_][\w.-]*)?$/)
  return match === null ? null : (match[1] ?? '')
})

const suggestions = computed<string[]>(() => {
  const prefix = pendingRef.value
  if (prefix === null) return []
  return form.fieldNames
    .filter((name) => name.startsWith(prefix))
    .slice(0, 8)
})

const issues = computed(() =>
  (form.issuesByNode.get(props.nodeId) ?? []).filter((issue) =>
    issue.message.toLowerCase().startsWith(props.field.toLowerCase()))
)

const onInput = (): void => {
  suggestionsOpen.value = true
  highlighted.value = 0
}

const applySuggestion = (name: string): void => {
  const el = textareaRef.value?.$el
  if (el === undefined || el === null) return
  const cursor = el.selectionStart ?? props.modelValue.length
  const before = props.modelValue.slice(0, cursor)
  const after = props.modelValue.slice(cursor)
  const replaced = before.replace(/\$\{([A-Za-z_][\w.-]*)?$/, `\${${name}}`)
  emit('update:modelValue', replaced + after)
  suggestionsOpen.value = false
}

const onKeydown = (event: KeyboardEvent): void => {
  if (suggestions.value.length === 0) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    highlighted.value = (highlighted.value + 1) % suggestions.value.length
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    highlighted.value = (highlighted.value - 1 + suggestions.value.length) % suggestions.value.length
  } else if (event.key === 'Enter' || event.key === 'Tab') {
    event.preventDefault()
    applySuggestion(suggestions.value[highlighted.value])
  } else if (event.key === 'Escape') {
    suggestionsOpen.value = false
  }
}
</script>

<template>
  <div class="expression-input">
    <Textarea
      :id="inputId"
      ref="textareaRef"
      :model-value="modelValue"
      :placeholder="placeholder"
      :invalid="issues.some((i) => i.severity === 'error')"
      auto-resize
      rows="1"
      class="expression-textarea"
      :data-testid="`expr-${field}`"
      @update:model-value="emit('update:modelValue', $event ?? '')"
      @input="onInput"
      @keydown="onKeydown"
      @blur="suggestionsOpen = false"
    />
    <ul v-if="suggestions.length > 0" class="expression-suggestions" role="listbox">
      <li
        v-for="(name, i) in suggestions"
        :key="name"
        role="option"
        :aria-selected="i === highlighted"
        :class="{ highlighted: i === highlighted }"
        @mousedown.prevent="applySuggestion(name)"
      >
        <code>${{ '{' }}{{ name }}{{ '}' }}</code>
      </li>
    </ul>
    <small v-for="(issue, i) in issues" :key="i" class="expression-issue" :class="issue.severity">
      {{ issue.message }}
    </small>
  </div>
</template>

<style scoped>
.expression-input {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.expression-textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--odk-hint-font-size);
  width: 100%;
}

.expression-suggestions {
  position: absolute;
  top: 100%;
  inset-inline-start: 0;
  z-index: var(--odk-z-index-overlay);
  margin: 2px 0 0;
  padding: 4px;
  list-style: none;
  background: var(--odk-base-background-color);
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  min-width: 200px;
}

.expression-suggestions li {
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: var(--odk-hint-font-size);
}

.expression-suggestions li.highlighted,
.expression-suggestions li:hover {
  background: var(--odk-primary-lighter-background-color);
}

.expression-issue {
  font-size: 0.75rem;
}

.expression-issue.error {
  color: var(--odk-error-text-color);
}

.expression-issue.warning {
  color: var(--odk-warning-text-color);
}
</style>
