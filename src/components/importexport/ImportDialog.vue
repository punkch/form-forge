<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'

import FileDropzone from '@/components/importexport/FileDropzone.vue'
import { parseFormFile, type ImportParseResult } from '@/core/import-form'
import { isSheetScope, type Issue } from '@/core/validate'
import { useAppI18n } from '@/i18n'
import * as formsRepo from '@/persistence/forms-repo'

const { t } = useAppI18n()

const visible = defineModel<boolean>('visible', { required: true })

const router = useRouter()

const parsing = ref(false)
const fileName = ref('')
// shallowRef: the parsed FormDocument goes straight into IndexedDB, and a
// deep-reactive proxy would fail structured cloning (DataCloneError).
const result = shallowRef<ImportParseResult | null>(null)

const errors = computed(() => result.value?.issues.filter((i) => i.severity === 'error') ?? [])
const warnings = computed(() => result.value?.issues.filter((i) => i.severity !== 'error') ?? [])
const canImport = computed(() => result.value?.document != null && errors.value.length === 0)

const reset = (): void => {
  parsing.value = false
  fileName.value = ''
  result.value = null
}

const handleFile = async (file: File): Promise<void> => {
  parsing.value = true
  fileName.value = file.name
  try {
    result.value = await parseFormFile(file)
  } catch (error) {
    result.value = {
      kind: 'xform',
      document: null,
      issues: [{
        severity: 'error',
        code: 'import.failed',
        message: t('common.readFailed', { name: file.name, error: String(error) }),
        scope: {},
      }],
    }
  } finally {
    parsing.value = false
  }
}

const summaryLine = computed(() => t('importExport.import.readAs', {
  kind: result.value?.kind === 'xlsform'
    ? t('importExport.import.kindXlsform')
    : t('importExport.import.kindXform'),
}))

const problemCounts = computed(() => t('common.problemCounts', {
  errors: t('common.errorCount', { count: errors.value.length }, errors.value.length),
  warnings: t('common.warningCount', { count: warnings.value.length }, warnings.value.length),
}))

const locationOf = (issue: Issue): string => {
  if (isSheetScope(issue.scope)) {
    return `${issue.scope.sheet}!${issue.scope.column ?? ''}${issue.scope.row}`
  }
  return ''
}

const importNow = async (): Promise<void> => {
  const doc = result.value?.document
  if (doc == null) return
  const record = await formsRepo.createForm(doc)
  visible.value = false
  reset()
  await router.push({ name: 'editor', params: { formId: record.id } })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="t('importExport.import.header')"
    modal
    :style="{ width: '38rem' }"
    @hide="reset"
  >
    <FileDropzone
      v-if="result === null"
      accept=".xml,.xlsx,.xls"
      icon="pi pi-upload"
      :hint="t('importExport.import.dropHint')"
      :choose-label="t('common.chooseFile')"
      :loading="parsing"
      drop-testid="import-dropzone"
      pick-testid="import-pick"
      input-testid="import-file-input"
      @file="handleFile"
    />

    <div v-else class="import-report" data-testid="import-report">
      <p class="import-summary">
        <strong>{{ fileName }}</strong> {{ summaryLine }}
        <template v-if="result.issues.length === 0">{{ t('common.noProblems') }}</template>
        <template v-else>
          {{ problemCounts }}
        </template>
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

    <template #footer>
      <Button
        v-if="result !== null"
        :label="t('common.chooseAnotherFile')"
        severity="secondary"
        text
        @click="reset"
      />
      <Button :label="t('common.cancel')" severity="secondary" text @click="visible = false" />
      <Button
        :label="warnings.length > 0 ? t('importExport.import.confirmAnyway') : t('importExport.import.confirm')"
        :disabled="!canImport"
        data-testid="import-confirm"
        @click="importNow"
      />
    </template>
  </Dialog>
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
