<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, ref } from 'vue'

import TranslationGrid from '@/components/translations/TranslationGrid.vue'
import { addLanguage, languageKey, removeLanguage } from '@/core/model/translations'
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const { t } = useAppI18n()
const form = useFormStore()
const editor = useEditorStore()

const visible = computed({
  get: () => editor.activeDialog === 'translations',
  set: (open: boolean) => {
    if (!open && editor.activeDialog === 'translations') editor.activeDialog = null
  },
})

const languages = computed(() => form.doc?.languages ?? [])

// --- Add language -----------------------------------------------------------

const newName = ref('')
const newCode = ref('')

const newKey = computed(() => languageKey(newName.value, newCode.value))

const addError = computed<string | null>(() => {
  if (newName.value.trim() === '') return null
  if (languages.value.includes(newKey.value)) return t('dialogs.translations.alreadyExists', { key: newKey.value })
  return null
})

const add = (): void => {
  const key = newKey.value
  if (newName.value.trim() === '' || addError.value !== null) return
  // addLanguage migrates DEFAULT_LANG text into the first added language.
  form.mutate(t('dialogs.translations.undoAdd'), (d) => { addLanguage(d, key) })
  newName.value = ''
  newCode.value = ''
}

// --- Remove language (two-step confirm) --------------------------------------

const confirmingRemove = ref<string | null>(null)

const requestRemove = (lang: string): void => {
  if (confirmingRemove.value !== lang) {
    confirmingRemove.value = lang
    return
  }
  confirmingRemove.value = null
  form.mutate(t('dialogs.translations.undoRemove'), (d) => { removeLanguage(d, lang) })
  if (editor.displayLanguage === lang) editor.displayLanguage = null
}

// --- Default + display language ----------------------------------------------

const defaultLanguageOptions = computed(() =>
  languages.value.map((lang) => ({ label: lang, value: lang }))
)

const setDefaultLanguage = (value: string | null): void => {
  form.mutate(t('dialogs.translations.undoSetDefault'), (d) => {
    if (value === null) delete d.settings.defaultLanguage
    else d.settings.defaultLanguage = value
  })
}

const displayLanguageOptions = computed(() => [
  { label: t('dialogs.translations.defaultOption'), value: null },
  ...languages.value.map((lang) => ({ label: lang, value: lang })),
])
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="t('dialogs.translations.header')"
    modal
    maximizable
    class="translations-dialog"
    :style="{ width: '90vw', height: '85vh' }"
    :content-style="{ flex: '1', display: 'flex', minHeight: '0' }"
    data-testid="translations-dialog"
  >
    <div class="translations-layout">
      <aside class="language-panel">
        <h3>{{ t('dialogs.translations.languages') }}</h3>

        <ul class="language-rows">
          <li v-for="lang in languages" :key="lang" class="language-row" :data-testid="`language-row-${lang}`">
            <span class="language-name">{{ lang }}</span>
            <Button
              icon="pi pi-trash"
              size="small"
              text
              rounded
              severity="secondary"
              :aria-label="t('dialogs.translations.removeLanguage')"
              :data-testid="`remove-language-${lang}`"
              @click="requestRemove(lang)"
            />
            <div v-if="confirmingRemove === lang" class="remove-confirm" data-testid="remove-confirm">
              <small>{{ t('dialogs.translations.removeWarning', { lang }) }}</small>
              <Button
                :label="t('dialogs.translations.remove')"
                severity="danger"
                size="small"
                data-testid="remove-confirm-button"
                @click="requestRemove(lang)"
              />
              <Button
                :label="t('dialogs.translations.keep')"
                severity="secondary"
                size="small"
                text
                @click="confirmingRemove = null"
              />
            </div>
          </li>
        </ul>

        <div class="add-language">
          <span class="field-title">{{ t('dialogs.translations.addLanguage') }}</span>
          <div class="add-inputs">
            <InputText
              v-model="newName"
              :placeholder="t('dialogs.translations.namePlaceholder')"
              class="add-name"
              data-testid="new-language-name"
              @keydown.enter.prevent="add"
            />
            <InputText
              v-model="newCode"
              :placeholder="t('dialogs.translations.codePlaceholder')"
              class="add-code"
              data-testid="new-language-code"
              @keydown.enter.prevent="add"
            />
            <Button
              icon="pi pi-plus"
              :aria-label="t('dialogs.translations.addLanguage')"
              :disabled="newName.trim() === '' || addError !== null"
              data-testid="add-language"
              @click="add"
            />
          </div>
          <small v-if="newName.trim() !== '' && addError === null" class="add-preview">
            {{ t('dialogs.translations.willBeAddedAs') }} <code>{{ newKey }}</code>
          </small>
          <small v-if="addError !== null" class="add-error">{{ addError }}</small>
        </div>

        <label class="field">
          <span class="field-title">{{ t('dialogs.translations.defaultLanguage') }}</span>
          <Select
            :model-value="form.doc?.settings.defaultLanguage ?? null"
            :options="defaultLanguageOptions"
            option-label="label"
            option-value="value"
            show-clear
            :placeholder="t('dialogs.translations.unsetPlaceholder')"
            data-testid="default-language"
            @update:model-value="setDefaultLanguage"
          />
        </label>

        <label class="field">
          <span class="field-title">{{ t('dialogs.translations.showInEditor') }}</span>
          <Select
            :model-value="editor.displayLanguage"
            :options="displayLanguageOptions"
            option-label="label"
            option-value="value"
            data-testid="display-language"
            @update:model-value="editor.displayLanguage = $event"
          />
          <small class="field-hint">
            {{ t('dialogs.translations.displayHint') }}
          </small>
        </label>
      </aside>

      <TranslationGrid />
    </div>
  </Dialog>
</template>

<style scoped>
.translations-layout {
  display: flex;
  gap: var(--odk-spacing-xl);
  flex: 1;
  min-height: 0;
  width: 100%;
}

.language-panel {
  width: 18rem;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-l);
  overflow-y: auto;
  border-inline-end: 1px solid var(--odk-border-color);
  padding-inline-end: var(--odk-spacing-l);
}

.language-panel h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 500;
}

.language-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.language-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--odk-spacing-s);
  padding: var(--odk-spacing-s) 0;
  border-bottom: 1px solid var(--odk-border-color);
}

.language-row:last-child {
  border-bottom: none;
}

.language-name {
  flex: 1;
}

.remove-confirm {
  flex-basis: 100%;
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  background: var(--odk-light-background-color);
  border-radius: var(--odk-radius);
  padding: var(--odk-spacing-s);
}

.remove-confirm small {
  flex: 1;
  color: var(--odk-warning-text-color);
}

.add-language,
.field {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.field-title {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.add-inputs {
  display: flex;
  gap: var(--odk-spacing-s);
}

.add-name {
  flex: 1;
  min-width: 0;
}

.add-code {
  width: 4rem;
}

.add-preview,
.field-hint {
  color: var(--odk-muted-text-color);
  font-size: 0.75rem;
}

.add-error {
  color: var(--odk-error-text-color);
  font-size: 0.75rem;
}
</style>
