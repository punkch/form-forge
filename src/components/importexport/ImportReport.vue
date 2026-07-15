<script setup lang="ts">
/**
 * The shared parse report shown after a form is read from a file or pulled from
 * ODK Central: a summary line (name + XLSForm/XForm kind + problem counts) and
 * the per-issue list. Presentational — the parent owns the confirm/land actions
 * and its own error/warning gating; this only renders `result`.
 */
import { computed } from 'vue'

import type { ImportParseResult } from '@/core/import-form'
import { isSheetScope, type Issue } from '@/core/validate'
import { useAppI18n } from '@/i18n'

const props = defineProps<{
  result: ImportParseResult
  /** The form's display name (file name, or the pulled form's title). */
  name: string
}>()

const { t } = useAppI18n()

const errors = computed(() => props.result.issues.filter((i) => i.severity === 'error'))
const warnings = computed(() => props.result.issues.filter((i) => i.severity !== 'error'))

const summaryLine = computed(() => t('importExport.import.readAs', {
  kind: props.result.kind === 'xlsform'
    ? t('importExport.import.kindXlsform')
    : t('importExport.import.kindXform'),
}))

const problemCounts = computed(() => t('common.problemCounts', {
  errors: t('common.errorCount', { count: errors.value.length }, errors.value.length),
  warnings: t('common.warningCount', { count: warnings.value.length }, warnings.value.length),
}))

const locationOf = (issue: Issue): string =>
  isSheetScope(issue.scope) ? `${issue.scope.sheet}!${issue.scope.column ?? ''}${issue.scope.row}` : ''
</script>

<template>
  <div class="import-report" data-testid="import-report">
    <p class="import-summary">
      <strong>{{ name }}</strong> {{ summaryLine }}
      <template v-if="result.issues.length === 0">{{ t('common.noProblems') }}</template>
      <template v-else>{{ problemCounts }}</template>
    </p>
    <ul v-if="result.issues.length > 0" class="import-issues">
      <li v-for="(issue, i) in result.issues" :key="i" :class="issue.severity">
        <i :class="issue.severity === 'error' ? 'pi pi-times-circle' : 'pi pi-exclamation-triangle'" />
        <span>
          <code v-if="locationOf(issue)">{{ locationOf(issue) }}</code>
          {{ issue.message }}
        </span>
      </li>
    </ul>
    <p v-if="errors.length > 0" class="import-blocked">
      {{ t('importExport.import.fixAndRetry') }}
    </p>
  </div>
</template>

<style scoped>
.import-summary {
  margin: 0 0 var(--odk-spacing-m);
}

.import-issues {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 40vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
  font-size: var(--odk-hint-font-size);
}

.import-issues li {
  display: flex;
  gap: var(--odk-spacing-s);
  align-items: flex-start;
}

.import-issues li.error i {
  color: var(--odk-error-text-color);
}

.import-issues li.warning i,
.import-issues li.info i {
  color: var(--odk-warning-text-color);
}

.import-issues code {
  background: var(--odk-light-background-color);
  padding: 0 4px;
  border-radius: 3px;
  margin-inline-end: 4px;
}

.import-blocked {
  margin: var(--odk-spacing-m) 0 0;
  color: var(--odk-error-text-color);
  font-size: var(--odk-hint-font-size);
}
</style>
