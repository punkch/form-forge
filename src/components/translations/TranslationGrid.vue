<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import { computed, ref } from 'vue'

import { exactText } from '@/core/model/display'
import {
  collectTranslationSites,
  hasAnyText,
  isHintSite,
  isRarelyUsedSite,
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
const showRarelyUsed = ref(false)

// Hints are hidden by default only while NO hint carries text — a form that
// uses hints must never silently drop them from the grid (and its stats).
// Evaluated once per dialog open (the grid remounts with the dialog).
const showHints = ref(sites.value.some((s) => isHintSite(s.ref) && hasAnyText(s.text)))

// The toggle-aware site list: what the grid exposes at all. Stats compute
// over this set (not the untranslated-filtered rows) so translated/total
// matches what the toggles expose.
const baseSites = computed(() =>
  sites.value.filter((s) =>
    (showRarelyUsed.value || !isRarelyUsedSite(s.ref)) &&
    (showHints.value || !isHintSite(s.ref))
  )
)

const isUntranslated = (site: TranslationSite): boolean =>
  languages.value.some((lang) => exactText(site.text, lang) === '')

// The filter is inert with zero languages: its checkbox hides then
// (v-if in the toolbar), but the ref can still be true from before the last
// language was removed in this dialog session — without the length guard the
// grid would empty out under an unreachable toggle.
const rows = computed(() =>
  untranslatedOnly.value && languages.value.length > 0
    ? baseSites.value.filter(isUntranslated)
    : baseSites.value
)

const stats = computed(() =>
  Object.fromEntries(languages.value.map((lang) => [lang, translationStats(baseSites.value, lang)]))
)

// Sentinel-column rule: zero-language docs edit all their text through this
// column ("Text"); multilingual docs only surface it while merge-conflict
// leftovers remain ("Unassigned"). When 'default' is literally a declared
// language it renders as a normal language column instead. Computed over the
// unfiltered sites so a toggle can't hide a leftover sentinel value.
const showSentinelColumn = computed(() =>
  languages.value.length === 0 ||
    (!languages.value.includes(DEFAULT_LANG) &&
      sites.value.some((s) => exactText(s.text, DEFAULT_LANG) !== ''))
)
const sentinelUnassigned = computed(() => showSentinelColumn.value && languages.value.length > 0)

// Same resolved text the sentinel column header renders — reused for the
// cell aria-labels so they never drift from what's visually shown.
const sentinelColumnLabel = computed(() =>
  sentinelUnassigned.value ? t('dialogs.translationGrid.unassignedColumn') : t('dialogs.translationGrid.textColumn')
)

/** Media cells hold attachment filenames (the fetchFormAttachment contract),
 * not prose — flagged with a subtle monospace affordance. */
const isMediaSite = (site: TranslationSite): boolean =>
  site.ref.kind === 'node-media' || site.ref.kind === 'choice-media'

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
      <label class="toolbar-toggle">
        <Checkbox
          v-model="showHints"
          binary
          data-testid="show-hints"
        />
        <span>{{ t('dialogs.translationGrid.showHints') }}</span>
      </label>
      <label class="toolbar-toggle">
        <Checkbox
          v-model="showRarelyUsed"
          binary
          data-testid="show-rarely-used"
        />
        <span>{{ t('dialogs.translationGrid.showRarelyUsed') }}</span>
      </label>
      <label v-if="languages.length > 0" class="toolbar-toggle">
        <Checkbox
          v-model="untranslatedOnly"
          binary
          data-testid="untranslated-only"
        />
        <span>{{ t('dialogs.translationGrid.untranslatedOnly') }}</span>
      </label>
    </div>

    <p v-if="sentinelUnassigned" class="grid-note note-unassigned" data-testid="unassigned-hint">
      {{ t('dialogs.translationGrid.unassignedHint') }}
    </p>

    <p v-if="rows.length === 0" class="grid-note" data-testid="grid-empty">
      {{ untranslatedOnly ? t('dialogs.translationGrid.allTranslated') : t('dialogs.translationGrid.nothingToTranslate') }}
    </p>

    <div v-else class="grid-scroll">
      <table>
        <thead>
          <tr>
            <th class="context-col">{{ t('dialogs.translationGrid.stringColumn') }}</th>
            <th v-if="showSentinelColumn" :class="{ 'col-unassigned': sentinelUnassigned }">
              {{ sentinelColumnLabel }}
            </th>
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
            <td v-if="showSentinelColumn" :class="{ 'col-unassigned': sentinelUnassigned }">
              <InputText
                :model-value="exactText(site.text, DEFAULT_LANG)"
                class="cell-input"
                :class="{ 'cell-filename': isMediaSite(site) }"
                :aria-label="`${site.context} — ${sentinelColumnLabel}`"
                :data-testid="`cell-${siteKey(site.ref)}-default`"
                @update:model-value="editCell(site, DEFAULT_LANG, $event ?? '')"
              />
            </td>
            <td v-for="lang in languages" :key="lang">
              <InputText
                :model-value="exactText(site.text, lang)"
                class="cell-input"
                :class="{
                  'cell-missing': exactText(site.text, lang) === '',
                  'cell-filename': isMediaSite(site),
                }"
                :aria-label="`${site.context} — ${lang}`"
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
  gap: var(--odk-spacing-l);
}

.toolbar-toggle {
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

.note-unassigned {
  color: var(--odk-warning-text-color);
}

/* Warning tint marking leftover sentinel text in a multilingual doc. */
.col-unassigned {
  background: var(--odk-warning-background-color, #fff8e1);
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

.cell-filename {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--odk-hint-font-size);
}
</style>
