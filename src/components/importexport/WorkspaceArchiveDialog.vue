<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { computed, ref, shallowRef } from 'vue'

import FileDropzone from '@/components/importexport/FileDropzone.vue'
import { readWorkspaceArchive, type ParsedArchiveForm, type ReadWorkspaceArchiveResult } from '@/core/workspace/archive'
import { useAppI18n } from '@/i18n'
import { importArchiveForms } from '@/persistence/workspace-io'

const visible = defineModel<boolean>('visible', { required: true })

const { t } = useAppI18n()
const toast = useToast()

const parsing = ref(false)
const importing = ref(false)
const fileName = ref('')
// shallowRef: the parsed FormDocuments go straight into IndexedDB, and a
// deep-reactive proxy would fail structured cloning (DataCloneError).
const result = shallowRef<ReadWorkspaceArchiveResult | null>(null)

const errors = computed(() => result.value?.issues.filter((i) => i.severity === 'error') ?? [])
const warnings = computed(() => result.value?.issues.filter((i) => i.severity !== 'error') ?? [])
const canImport = computed(() => (result.value?.forms.length ?? 0) > 0 && !importing.value)

const summaryText = computed((): string => {
  const parsed = result.value
  if (parsed === null) return ''
  const found = t('importExport.workspaceArchive.formsFound', { count: parsed.forms.length }, parsed.forms.length)
  const problems = parsed.issues.length === 0
    ? t('common.noProblems')
    : t('common.problemCounts', {
      errors: t('common.errorCount', { count: errors.value.length }, errors.value.length),
      warnings: t('common.warningCount', { count: warnings.value.length }, warnings.value.length),
    })
  return t('importExport.workspaceArchive.summary', { found, problems })
})

const importLabel = computed((): string => {
  const count = result.value?.forms.length ?? 0
  return count === 0
    ? t('importExport.workspaceArchive.importButton')
    : t('importExport.workspaceArchive.importButtonCount', { count }, count)
})

const attachmentText = (form: ParsedArchiveForm): string =>
  t('importExport.workspaceArchive.attachmentCount',
    { count: form.attachments.length }, form.attachments.length)

const reset = (): void => {
  parsing.value = false
  importing.value = false
  fileName.value = ''
  result.value = null
}

const handleFile = async (file: File): Promise<void> => {
  parsing.value = true
  fileName.value = file.name
  try {
    result.value = await readWorkspaceArchive(await file.arrayBuffer())
  } catch (err) {
    result.value = {
      forms: [],
      issues: [{
        severity: 'error',
        code: 'workspace.read-failed',
        message: t('common.readFailed', { name: file.name, error: String(err) }),
        scope: {},
      }],
    }
  } finally {
    parsing.value = false
  }
}

const importNow = async (): Promise<void> => {
  const forms = result.value?.forms
  if (forms === undefined || forms.length === 0 || importing.value) return
  importing.value = true
  try {
    const { imported, issues } = await importArchiveForms(forms)
    toast.add({
      severity: 'success',
      summary: t('importExport.workspaceArchive.importedSummary'),
      detail: t('importExport.workspaceArchive.importedDetail', { count: imported }, imported),
      life: 3000,
    })
    for (const issue of issues) {
      toast.add({
        severity: issue.severity === 'error' ? 'error' : 'warn',
        summary: t('importExport.workspaceArchive.importIssueSummary'),
        detail: issue.message,
        life: 6000,
      })
    }
    visible.value = false
    reset()
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="t('importExport.workspaceArchive.dialogTitle')"
    modal
    :style="{ width: '38rem' }"
    data-testid="workspace-archive-dialog"
    @hide="reset"
  >
    <FileDropzone
      v-if="result === null"
      accept=".zip"
      icon="pi pi-box"
      :hint="t('importExport.workspaceArchive.dropHint')"
      :choose-label="t('common.chooseFile')"
      :loading="parsing"
      drop-testid="workspace-archive-drop"
      pick-testid="workspace-archive-pick"
      input-testid="workspace-archive-file-input"
      @file="handleFile"
    />

    <div v-else class="import-report" data-testid="workspace-archive-report">
      <p class="import-summary">
        <strong>{{ fileName }}</strong> {{ summaryText }}
      </p>
      <ul v-if="result.forms.length > 0" class="archive-forms" data-testid="workspace-archive-forms">
        <li v-for="form in result.forms" :key="form.recordId">
          <i class="pi pi-file" />
          <span class="archive-form-title">{{ form.meta.title }}</span>
          <span class="archive-form-meta">
            <code>{{ form.meta.formId }}</code>
            <span>{{ attachmentText(form) }}</span>
          </span>
        </li>
      </ul>
      <ul v-if="result.issues.length > 0" class="import-issues" data-testid="workspace-archive-issues">
        <li v-for="(issue, i) in result.issues" :key="i" :class="issue.severity">
          <i :class="issue.severity === 'error' ? 'pi pi-times-circle' : 'pi pi-exclamation-triangle'" />
          <span>{{ issue.message }}</span>
        </li>
      </ul>
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
        :label="importLabel"
        :disabled="!canImport"
        :loading="importing"
        data-testid="workspace-archive-import"
        @click="importNow"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.import-summary {
  margin: 0 0 var(--odk-spacing-m);
}

.archive-forms {
  list-style: none;
  margin: 0 0 var(--odk-spacing-m);
  padding: 0;
  max-height: 40vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.archive-forms li {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
  padding: var(--odk-spacing-s) var(--odk-spacing-m);
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
}

.archive-form-title {
  font-weight: 500;
}

.archive-form-meta {
  margin-inline-start: auto;
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.archive-form-meta code {
  background: var(--odk-light-background-color);
  padding: 0 4px;
  border-radius: 3px;
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
</style>
