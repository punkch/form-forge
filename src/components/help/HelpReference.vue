<script setup lang="ts">
// Browsable, offline reference of every question type: search + category
// groups; clicking a type swaps the dialog content to that type's help.
// Opened from the header Help button (editor.activeDialog === 'help-reference').
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { computed, ref, watch } from 'vue'

import QuestionTypeHelpContent from '@/components/help/QuestionTypeHelpContent.vue'
import { getQuestionType } from '@/core/registry/question-types'
import { ODK_QUESTION_TYPES_DOCS_URL } from '@/help/content'
import { groupTypesBySearch } from '@/help/search'
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'

const { t } = useAppI18n()
const editor = useEditorStore()

const visible = computed({
  get: () => editor.activeDialog === 'help-reference',
  set: (open: boolean) => { editor.activeDialog = open ? 'help-reference' : null },
})

const search = ref('')
const selectedType = ref<string | null>(null)

// Reopening always starts on a fresh list, not last session's detail.
watch(visible, (open) => {
  if (!open) {
    search.value = ''
    selectedType.value = null
  }
})

const groups = computed(() => groupTypesBySearch(search.value))

const selectedDef = computed(() =>
  selectedType.value === null ? undefined : getQuestionType(selectedType.value))
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="t('help.ui.reference.title')"
    modal
    :style="{ width: '44rem', maxWidth: '95vw' }"
    data-testid="help-reference"
  >
    <div v-if="!selectedDef" class="help-ref-list">
      <InputText
        v-model="search"
        :placeholder="t('help.ui.reference.searchPlaceholder')"
        autofocus
        fluid
        data-testid="help-search"
      />
      <p v-if="groups.length === 0" class="help-ref-empty" data-testid="help-ref-empty">
        {{ t('help.ui.reference.noMatches') }}
      </p>
      <section v-for="group in groups" :key="group.category" class="help-ref-group">
        <h3>{{ group.label }}</h3>
        <ul>
          <li v-for="def in group.items" :key="def.type">
            <button
              class="help-ref-item"
              :data-testid="`help-ref-item-${def.type}`"
              @click="selectedType = def.type"
            >
              <i :class="[def.icon, `cat-${def.category}`]" />
              <span class="help-ref-item-text">
                <span class="help-ref-item-title">{{ def.title }}</span>
                <span class="help-ref-item-description">{{ def.description }}</span>
              </span>
              <i class="pi pi-chevron-right help-ref-item-chevron" />
            </button>
          </li>
        </ul>
      </section>
    </div>

    <div v-else class="help-ref-detail" data-testid="help-ref-detail">
      <Button
        :label="t('help.ui.reference.back')"
        icon="pi pi-arrow-left"
        severity="secondary"
        text
        size="small"
        class="help-ref-back"
        data-testid="help-ref-back"
        @click="selectedType = null"
      />
      <div class="help-ref-detail-header">
        <i :class="[selectedDef.icon, `cat-${selectedDef.category}`]" />
        <span class="help-ref-detail-title">{{ selectedDef.title }}</span>
        <code class="help-ref-detail-token">{{ selectedDef.type }}</code>
      </div>
      <QuestionTypeHelpContent :def="selectedDef" />
    </div>

    <template #footer>
      <p class="help-ref-attribution">
        {{ t('help.ui.reference.attribution') }}
        <a :href="ODK_QUESTION_TYPES_DOCS_URL" target="_blank" rel="noopener noreferrer">
          {{ t('help.ui.reference.attributionLink') }}
        </a>
      </p>
    </template>
  </Dialog>
</template>

<style scoped>
.help-ref-list {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
}

.help-ref-empty {
  margin: var(--odk-spacing-l) 0;
  text-align: center;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.help-ref-group h3 {
  margin: var(--odk-spacing-m) 0 var(--odk-spacing-s);
  font-size: var(--odk-hint-font-size);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--odk-muted-text-color);
}

.help-ref-group ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.help-ref-item {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
  width: 100%;
  padding: var(--odk-spacing-s) var(--odk-spacing-m);
  border: none;
  border-radius: var(--odk-radius);
  background: none;
  font-family: inherit;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-text-color);
  text-align: start;
  cursor: pointer;
}

.help-ref-item:hover,
.help-ref-item:focus-visible {
  background: var(--odk-primary-lighter-background-color);
}

/* Category color comes from the shared i.cat-* rules in styles/builder.css. */
.help-ref-item > i {
  flex-shrink: 0;
  font-size: var(--odk-icon-s);
}

.help-ref-item-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.help-ref-item-title {
  font-weight: 500;
}

.help-ref-item-description {
  color: var(--odk-muted-text-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.help-ref-item-chevron {
  color: var(--odk-light-muted-text-color);
  font-size: 0.7rem;
}

.help-ref-detail {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-l);
}

.help-ref-back {
  align-self: flex-start;
}

.help-ref-detail-header {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
}

.help-ref-detail-header i {
  font-size: var(--odk-icon-m);
}

.help-ref-detail-title {
  font-size: var(--odk-question-font-size);
  font-weight: 500;
}

.help-ref-detail-token {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
  background: var(--odk-muted-background-color);
  border-radius: var(--odk-radius);
  padding: 1px 6px;
}

.help-ref-attribution {
  margin: 0;
  width: 100%;
  text-align: start;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.help-ref-attribution a {
  color: var(--odk-primary-text-color);
}
</style>
