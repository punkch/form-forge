<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import { computed, ref } from 'vue'

import { exactText } from '@/core/model/display'
import {
  collectTranslationSites,
  setSiteText,
  siteKey,
  translationStats,
  type TranslationSite,
} from '@/core/model/translations'
import { DEFAULT_LANG, type FormDocument } from '@/core/model/types'
import { useAppI18n } from '@/i18n'
import { useFormStore } from '@/stores/form'

const { t } = useAppI18n()
const form = useFormStore()

const languages = computed(() => form.doc?.languages ?? [])

const sites = computed<TranslationSite[]>(() =>
  form.doc === null ? [] : collectTranslationSites(form.doc as FormDocument)
)

const untranslatedOnly = ref(false)

const isUntranslated = (site: TranslationSite): boolean =>
  languages.value.some((lang) => exactText(site.text, lang) === '')

const rows = computed(() =>
  untranslatedOnly.value ? sites.value.filter(isUntranslated) : sites.value
)

const stats = computed(() =>
  Object.fromEntries(languages.value.map((lang) => [lang, translationStats(sites.value, lang)]))
)

const editCell = (site: TranslationSite, lang: string, value: string): void => {
  // Per-cell coalescing: rapid keystrokes in one cell fold into one undo
  // entry, but moving to another cell/language starts a new one.
  form.mutate(t('dialogs.translationGrid.undoEditCell', { key: siteKey(site.ref), lang }), (d) => {
    setSiteText(d, site.ref, lang, value)
  }, { coalesce: true })
}
</script>

<template>
  <div class="translation-grid" data-testid="translation-grid">
    <div class="grid-toolbar">
      <label class="untranslated-filter">
        <Checkbox
          v-model="untranslatedOnly"
          binary
          data-testid="untranslated-only"
        />
        <span>{{ t('dialogs.translationGrid.untranslatedOnly') }}</span>
      </label>
    </div>

    <p v-if="languages.length === 0" class="grid-note">
      {{ t('dialogs.translationGrid.addLanguageFirst') }}
    </p>
    <p v-else-if="rows.length === 0" class="grid-note" data-testid="grid-empty">
      {{ untranslatedOnly ? t('dialogs.translationGrid.allTranslated') : t('dialogs.translationGrid.nothingToTranslate') }}
    </p>

    <div v-else class="grid-scroll">
      <table>
        <thead>
          <tr>
            <th class="context-col">{{ t('dialogs.translationGrid.stringColumn') }}</th>
            <th>{{ t('dialogs.translationGrid.defaultColumn') }}</th>
            <th
              v-for="lang in languages"
              :key="lang"
              :data-testid="`lang-header-${lang}`"
            >
              {{ lang }}
              <span class="completeness" :data-testid="`lang-completeness-${lang}`">
                {{ stats[lang].translated }}/{{ stats[lang].total }}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="site in rows" :key="siteKey(site.ref)" :data-testid="`row-${siteKey(site.ref)}`">
            <td class="context-col">{{ site.context }}</td>
            <td>
              <InputText
                :model-value="exactText(site.text, DEFAULT_LANG)"
                class="cell-input"
                :data-testid="`cell-${siteKey(site.ref)}-default`"
                @update:model-value="editCell(site, DEFAULT_LANG, $event ?? '')"
              />
            </td>
            <td v-for="lang in languages" :key="lang">
              <InputText
                :model-value="exactText(site.text, lang)"
                class="cell-input"
                :class="{ 'cell-missing': exactText(site.text, lang) === '' }"
                :data-testid="`cell-${siteKey(site.ref)}-${lang}`"
                @update:model-value="editCell(site, lang, $event ?? '')"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.translation-grid {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
  min-height: 0;
  flex: 1;
}

.grid-toolbar {
  display: flex;
  justify-content: flex-end;
}

.untranslated-filter {
  display: inline-flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.grid-note {
  margin: 0;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.grid-scroll {
  overflow: auto;
  min-height: 0;
  flex: 1;
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
}

table {
  border-collapse: collapse;
  width: 100%;
}

th,
td {
  padding: var(--odk-spacing-s) var(--odk-spacing-m);
  text-align: start;
  border-bottom: 1px solid var(--odk-border-color);
  min-width: 12rem;
}

th {
  position: sticky;
  top: 0;
  background: var(--odk-light-background-color);
  font-size: var(--odk-hint-font-size);
  font-weight: 500;
  z-index: 1;
}

.context-col {
  min-width: 10rem;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
  white-space: nowrap;
}

.completeness {
  margin-inline-start: var(--odk-spacing-s);
  font-weight: 400;
  color: var(--odk-muted-text-color);
}

.cell-input {
  width: 100%;
}

.cell-missing {
  background: var(--odk-warning-background-color, #fff8e1);
}
</style>
