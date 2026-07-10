<script setup lang="ts">
// Right-side help drawer, driven by editor.activeDialog === 'help-reference'.
// Two modes: a browsable list of every question type (search + category
// groups) when editor.helpTypeId is null — opened from the header Help
// button — and a single type's detail view when helpTypeId is set (deep
// links via editor.openTypeHelp, or selecting a type from the list).
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
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

// Reopening from the header always starts on a fresh list, not last
// session's detail; deep links set helpTypeId again before opening.
watch(visible, (open) => {
  if (!open) {
    search.value = ''
    editor.helpTypeId = null
  }
})

const groups = computed(() => groupTypesBySearch(search.value))

const def = computed(() =>
  editor.helpTypeId === null ? undefined : getQuestionType(editor.helpTypeId))
</script>

<template>
  <Drawer
    v-model:visible="visible"
    position="right"
    :style="{ width: '26rem', maxWidth: '92vw' }"
    data-testid="help-drawer"
  >
    <template #header>
      <div v-if="def" class="help-drawer-header">
        <i :class="[def.icon, `cat-${def.category}`]" />
        <span class="help-drawer-title">{{ def.title }}</span>
        <code class="help-drawer-token">{{ def.type }}</code>
      </div>
      <span v-else class="help-drawer-title">{{ t('help.ui.reference.title') }}</span>
    </template>

    <div v-if="!def" class="help-ref-list" data-testid="help-reference">
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
          <li v-for="item in group.items" :key="item.type">
            <button
              class="help-ref-item"
              :data-testid="`help-ref-item-${item.type}`"
              @click="editor.helpTypeId = item.type"
            >
              <i :class="[item.icon, `cat-${item.category}`]" />
              <span class="help-ref-item-text">
                <span class="help-ref-item-title">{{ item.title }}</span>
                <span class="help-ref-item-description">{{ item.description }}</span>
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
        @click="editor.helpTypeId = null"
      />
      <QuestionTypeHelpContent :def="def" />
    </div>

    <template #footer>
      <p class="help-ref-attribution">
        {{ t('help.ui.reference.attribution') }}
        <a :href="ODK_QUESTION_TYPES_DOCS_URL" target="_blank" rel="noopener noreferrer">
          {{ t('help.ui.reference.attributionLink') }}
        </a>
      </p>
    </template>
  </Drawer>
</template>

<style scoped>
.help-drawer-header {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
  min-width: 0;
}

.help-drawer-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.help-drawer-token {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
  background: var(--odk-muted-background-color);
  border-radius: var(--odk-radius);
  padding: 1px 6px;
}

/* Category color comes from the shared i.cat-* rules in styles/builder.css. */
.help-drawer-header i {
  font-size: var(--odk-icon-s);
}

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
