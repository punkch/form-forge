<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { computed, ref, shallowRef } from 'vue'

import FileDropzone from '@/components/importexport/FileDropzone.vue'
import { readWorkspaceArchive, type ParsedArchiveForm, type ReadWorkspaceArchiveResult } from '@/core/workspace/archive'
import { useAppI18n } from '@/i18n'
import { setLocale } from '@/i18n/setLocale'
import { importWorkspaceBackup, remapPreferencesFormIds } from '@/persistence/workspace-io'
import { useUiStore } from '@/stores/ui'

const visible = defineModel<boolean>('visible', { required: true })

const { t } = useAppI18n()
const toast = useToast()
const ui = useUiStore()

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

// Central section summary — shown only when a v2 backup actually carries some
// Central data (an empty central/ section stays silent).
const central = computed(() => result.value?.central)
const includesCredentials = computed((): boolean => central.value?.vault !== undefined)
const hasPreferences = computed((): boolean => result.value?.preferences !== undefined)
const templateCount = computed((): number => result.value?.templates?.length ?? 0)
const hasTemplates = computed((): boolean => templateCount.value > 0)
const hasCentralData = computed((): boolean => {
  const c = central.value
  return c !== undefined && (c.servers.length > 0 || c.targets.length > 0 || includesCredentials.value)
})
const centralSummary = computed((): string => {
  const c = central.value
  if (c === undefined) return ''
  const servers = t('importExport.workspaceArchive.serverCount', { count: c.servers.length }, c.servers.length)
  const targets = t('importExport.workspaceArchive.targetCount', { count: c.targets.length }, c.targets.length)
  return t('importExport.workspaceArchive.centralSummary', { servers, targets })
})

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
    const { imported, templatesImported, formIdMap, issues } = await importWorkspaceBackup({
      forms,
      central: result.value?.central,
      templates: result.value?.templates,
    })
    toast.add({
      severity: 'success',
      summary: t('importExport.workspaceArchive.importedSummary'),
      detail: t('importExport.workspaceArchive.importedDetail', { count: imported }, imported),
      life: 3000,
    })
    if (templatesImported > 0) {
      toast.add({
        severity: 'info',
        summary: t('importExport.workspaceArchive.templatesRestored', { count: templatesImported }, templatesImported),
        life: 3000,
      })
    }
    for (const issue of issues) {
      toast.add({
        severity: issue.severity === 'error' ? 'error' : 'warn',
        summary: t('importExport.workspaceArchive.importIssueSummary'),
        detail: issue.message,
        life: 6000,
      })
    }
    // Restore device UI preferences (theme/accent/language/…) if the backup
    // carried them. Setting the store applies theme/accent live; the language
    // switch additionally needs setLocale.
    const preferences = result.value?.preferences
    if (preferences !== undefined) {
      // Per-form export-format memory is keyed by the source workspace's
      // record ids — rekey it through this import's fresh ids first.
      ui.applyPreferences(remapPreferencesFormIds(preferences, formIdMap))
      setLocale(ui.locale)
      toast.add({
        severity: 'info',
        summary: t('importExport.workspaceArchive.preferencesRestored'),
        life: 3000,
      })
    }
    visible.value = false
    reset()
  } catch (err) {
    // A rejection after forms were committed would otherwise leave the dialog
    // open with no feedback — surface it so the user knows the import stopped.
    toast.add({
      severity: 'error',
      summary: t('importExport.workspaceArchive.importIssueSummary'),
      detail: t('common.readFailed', { name: fileName.value, error: String(err) }),
      life: 6000,
    })
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
      <p v-if="hasCentralData" class="import-central" data-testid="workspace-archive-central">
        <i class="pi pi-server" aria-hidden="true" />
        <span>{{ centralSummary }}</span>
        <span v-if="includesCredentials" class="import-central-creds">
          {{ t('importExport.workspaceArchive.includesCredentials') }}
        </span>
      </p>
      <p v-if="hasTemplates" class="import-central" data-testid="workspace-archive-templates">
        <i class="pi pi-clone" aria-hidden="true" />
        <span>{{ t('importExport.workspaceArchive.includesTemplates', { count: templateCount }, templateCount) }}</span>
      </p>
      <p v-if="hasPreferences" class="import-central" data-testid="workspace-archive-preferences">
        <i class="pi pi-sliders-h" aria-hidden="true" />
        <span>{{ t('importExport.workspaceArchive.includesPreferences') }}</span>
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

.import-central {
  margin: 0 0 var(--odk-spacing-m);
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: var(--odk-spacing-s);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.import-central-creds {
  color: var(--odk-warning-text-color);
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
