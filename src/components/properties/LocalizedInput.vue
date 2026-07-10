<script setup lang="ts">
// Shared language-aware text input for the properties panel. The input never
// displays text in a language other than the one it writes: the value is the
// exact editing-language text (no fallback), the default-language fallback
// appears as a placeholder only, and a visible badge names the language being
// edited. Parents receive the typed string plus the language it targets and
// own the setText call (so per-field undo labels stay correct).
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { computed } from 'vue'

import { useEditingLanguage } from '@/composables/useEditingLanguage'
import { displayText, exactText } from '@/core/model/display'
import type { Lang, LocalizedText } from '@/core/model/types'
import { useAppI18n } from '@/i18n'

const props = defineProps<{
  /** The localized text this field edits. Not a v-model: edits are surfaced
   * via the `edit` event so parents own the per-field setText/undo label. */
  value: LocalizedText | undefined
  /** Textarea (auto-resize) instead of a single-line input. */
  multiline?: boolean
  placeholder?: string
  /** Applied to the actual input element (existing e2e selectors depend on it). */
  dataTestid: string
}>()

const emit = defineEmits<{ edit: [value: string, lang: Lang] }>()

const { t } = useAppI18n()
const { editingLang, isTranslating, languageBadge } = useEditingLanguage()

const value = computed(() => exactText(props.value, editingLang.value))

// Translating with an empty selected language: surface the fallback text as a
// placeholder (never as editable text). Otherwise the caller's placeholder.
const effectivePlaceholder = computed(() => {
  if (isTranslating.value && value.value === '') {
    const fallback = displayText(props.value)
    if (fallback !== '') return fallback
  }
  return props.placeholder
})

const badgeTitle = computed(() =>
  languageBadge.value === null ? '' : t('properties.panel.editingLanguageBadge', { lang: languageBadge.value })
)

const onEdit = (typed: string): void => { emit('edit', typed, editingLang.value) }
</script>

<template>
  <div class="localized-input">
    <Textarea
      v-if="multiline"
      :model-value="value"
      auto-resize
      rows="1"
      class="localized-input-field"
      :placeholder="effectivePlaceholder"
      :data-testid="dataTestid"
      @update:model-value="onEdit($event ?? '')"
    />
    <InputText
      v-else
      :model-value="value"
      class="localized-input-field"
      :placeholder="effectivePlaceholder"
      :data-testid="dataTestid"
      @update:model-value="onEdit($event ?? '')"
    />
    <span
      v-if="isTranslating"
      class="localized-lang-badge"
      :title="badgeTitle"
      :aria-label="badgeTitle"
      :data-testid="`${dataTestid}-lang-badge`"
    >{{ languageBadge }}</span>
  </div>
</template>

<style scoped>
.localized-input {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
}

.localized-input-field {
  width: 100%;
}

.localized-lang-badge {
  align-self: flex-end;
  margin-top: 2px;
  padding: 0 var(--odk-spacing-s);
  border-radius: var(--odk-radius);
  background: var(--odk-muted-background-color);
  color: var(--odk-muted-text-color);
  font-size: 0.7rem;
  line-height: 1.5;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
