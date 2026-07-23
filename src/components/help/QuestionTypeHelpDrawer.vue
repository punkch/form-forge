<script setup lang="ts">
// Right-side help drawer, driven by editor.activeDialog === 'help-reference'.
// Two modes: a browsable list — workflow guides plus every question type
// (one search across both) — when neither editor.helpTypeId nor
// editor.helpGuideId is set (opened from the header Help button), and a
// detail view when a type or a guide is selected (deep links via
// editor.openTypeHelp / editor.openGuideHelp, or selecting from the list).
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import InputText from 'primevue/inputtext'
import { computed, ref, watch } from 'vue'

import GuideContent from '@/components/help/GuideContent.vue'
import QuestionTypeHelpContent from '@/components/help/QuestionTypeHelpContent.vue'
import { useTypeLabels } from '@/composables/useTypeLabels'
import { getQuestionType } from '@/core/registry/question-types'
import { guideHelp, ODK_QUESTION_TYPES_DOCS_URL } from '@/help/content'
import { GUIDE_KEYS } from '@/help/guides'
import { groupTypesBySearch, matchesFields } from '@/help/search'
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'

const { t } = useAppI18n()
const editor = useEditorStore()
const typeLabels = useTypeLabels()
const { typeTitle, typeDescription } = typeLabels

const visible = computed({
  get: () => editor.activeDialog === 'help-reference',
  set: (open: boolean) => { editor.activeDialog = open ? 'help-reference' : null },
})

const search = ref('')

// Reopening from the header always starts on a fresh list, not last
// session's detail; deep links set helpTypeId/helpGuideId again before
// opening.
watch(visible, (open) => {
  if (!open) {
    search.value = ''
    editor.helpTypeId = null
    editor.helpGuideId = null
  }
})

const groups = computed(() => groupTypesBySearch(search.value, typeLabels))

// Guides are matched on their *resolved* (translated) title/summary plus
// searchKeywords — unlike the registry, whose searchable fields are plain
// data, guide text lives in the i18n catalog and only exists resolved.
const guideItems = computed(() =>
  GUIDE_KEYS.filter((key) => {
    const guide = guideHelp[key]
    return matchesFields(search.value, [t(guide.title), t(guide.summary), ...(guide.searchKeywords ?? [])])
  }))

const def = computed(() =>
  editor.helpTypeId === null ? undefined : getQuestionType(editor.helpTypeId))

const guideKey = computed(() => editor.helpGuideId)

// One selected view drives the header and body: a type detail, a guide detail,
// or the browsable list when neither is selected.
const mode = computed<'list' | 'type' | 'guide'>(() =>
  def.value !== undefined ? 'type' : guideKey.value !== null ? 'guide' : 'list')

const backToList = (): void => {
  editor.helpTypeId = null
  editor.helpGuideId = null
}
</script>

<template>
  <!--
    PrimeVue Drawer hardcodes role="complementary" + aria-modal on its root,
    an invalid ARIA pairing per axe's aria-allowed-attr (aria-modal is only
    valid on role="dialog"/"alertdialog"). Drawer's render merges ptmi('root')
    — which folds in this component's own fallthrough attrs — LAST, after the
    hardcoded role, so a plain `role="dialog"` attribute here overrides it
    without needing `pt`. See tests/component/help.spec.ts for the regression
    spec asserting the rendered root role.
  -->
  <Drawer
    v-model:visible="visible"
    position="right"
    :style="{ width: '26rem', maxWidth: '92vw' }"
    data-testid="help-drawer"
    role="dialog"
  >
    <template #header>
      <div v-if="def" class="help-drawer-header">
        <i :class="[def.icon, `cat-${def.category}`]" />
        <span class="help-drawer-title">{{ typeTitle(def) }}</span>
        <code class="help-drawer-token">{{ def.type }}</code>
      </div>
      <span v-else-if="guideKey" class="help-drawer-title">{{ t(guideHelp[guideKey].title) }}</span>
      <span v-else class="help-drawer-title">{{ t('help.ui.reference.title') }}</span>
    </template>

    <div v-if="mode === 'list'" class="help-ref-list" data-testid="help-reference">
      <InputText
        v-model="search"
        :placeholder="t('help.ui.reference.searchPlaceholder')"
        autofocus
        fluid
        data-testid="help-search"
      />
      <p
        v-if="groups.length === 0 && guideItems.length === 0"
        class="help-ref-empty"
        data-testid="help-ref-empty"
      >
        {{ t('help.ui.reference.noMatches') }}
      </p>
      <section v-if="guideItems.length > 0" class="help-ref-group" data-testid="help-guides-section">
        <h3>{{ t('guides.ui.sectionTitle') }}</h3>
        <ul>
          <li v-for="key in guideItems" :key="key">
            <button
              class="help-ref-item"
              :data-testid="`help-guide-item-${key}`"
              @click="editor.openGuideHelp(key)"
            >
              <i class="pi pi-book help-guide-icon" />
              <span class="help-ref-item-text">
                <span class="help-ref-item-title">{{ t(guideHelp[key].title) }}</span>
                <span class="help-ref-item-description">{{ t(guideHelp[key].summary) }}</span>
              </span>
              <i class="pi pi-chevron-right help-ref-item-chevron" />
            </button>
          </li>
        </ul>
      </section>
      <section v-for="group in groups" :key="group.category" class="help-ref-group">
        <h3>{{ group.label }}</h3>
        <ul>
          <li v-for="item in group.items" :key="item.type">
            <button
              class="help-ref-item"
              :data-testid="`help-ref-item-${item.type}`"
              @click="editor.openTypeHelp(item.type)"
            >
              <i :class="[item.icon, `cat-${item.category}`]" />
              <span class="help-ref-item-text">
                <span class="help-ref-item-title">{{ typeTitle(item) }}</span>
                <span class="help-ref-item-description">{{ typeDescription(item) }}</span>
              </span>
              <i class="pi pi-chevron-right help-ref-item-chevron" />
            </button>
          </li>
        </ul>
      </section>
    </div>

    <div v-else class="help-ref-detail" data-testid="help-ref-detail">
      <Button
        :label="guideKey ? t('guides.ui.sectionTitle') : t('help.ui.reference.back')"
        icon="pi pi-arrow-left"
        severity="secondary"
        text
        size="small"
        class="help-ref-back"
        data-testid="help-ref-back"
        @click="backToList"
      />
      <QuestionTypeHelpContent v-if="def" :def="def" />
      <GuideContent v-else-if="guideKey" :guide="guideKey" />
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

/* Guides have no registry category; give their icon a neutral tone. */
.help-guide-icon {
  color: var(--odk-muted-text-color);
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
