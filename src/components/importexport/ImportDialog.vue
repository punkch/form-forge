<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { computed, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'

import CentralFormPicker from '@/components/central/CentralFormPicker.vue'
import CentralProjectPicker from '@/components/central/CentralProjectPicker.vue'
import CentralServerPicker from '@/components/central/CentralServerPicker.vue'
import FileDropzone from '@/components/importexport/FileDropzone.vue'
import { parseFormFile, type ImportParseResult } from '@/core/import-form'
import { isSheetScope, type Issue } from '@/core/validate'
import type { ArchiveAttachment } from '@/core/workspace/archive'
import { useAppI18n } from '@/i18n'
import { centralErrorKey as toCentralErrorKey } from '@/i18n/central-errors'
import type { FormRecord } from '@/persistence/db'
import * as formsRepo from '@/persistence/forms-repo'
import { useCentralStore } from '@/stores/central'
import { useEmbedStore } from '@/stores/embed'

const { t } = useAppI18n()

const visible = defineModel<boolean>('visible', { required: true })

const router = useRouter()
const confirm = useConfirm()
const toast = useToast()
const central = useCentralStore()
const embed = useEmbedStore()

type ImportSource = 'file' | 'central'
const source = ref<ImportSource>('file')

const parsing = ref(false)
const fileName = ref('')
// shallowRef: the parsed FormDocument goes straight into IndexedDB, and a
// deep-reactive proxy would fail structured cloning (DataCloneError).
const result = shallowRef<ImportParseResult | null>(null)

// --- Central-source state ---------------------------------------------------
const serverId = ref<string | null>(null)
const projectId = ref<number | null>(null)
const xmlFormId = ref<string | null>(null)
const importingCentral = ref(false)
const landing = ref(false)
const centralError = ref<unknown>(null)
// shallowRef: these carry Blobs; deep reactivity is pointless and risky here.
const centralAttachments = shallowRef<ArchiveAttachment[]>([])
const centralPublishedVersion = ref('')
const centralFormName = ref('')
// When a library form already uses the imported formId, the user must choose
// copy vs replace; this holds the colliding record until they decide.
const collisionRecord = shallowRef<FormRecord | null>(null)

// The "From Central" source is offered only once a server is registered, and
// never in embed (which uses the memory backend where servers do not persist).
const showSourceToggle = computed(() => central.hasServers && !embed.active)
const collisionPending = computed(() => collisionRecord.value !== null)

const errors = computed(() => result.value?.issues.filter((i) => i.severity === 'error') ?? [])
const warnings = computed(() => result.value?.issues.filter((i) => i.severity !== 'error') ?? [])
const canImport = computed(() => result.value?.document != null && errors.value.length === 0)

/** The current Central transport error's `central.errors.*` copy — deliberately
 * distinct from the file-oriented `common.readFailed` message. */
const centralErrorKey = computed(() => toCentralErrorKey(centralError.value))

const reset = (): void => {
  parsing.value = false
  fileName.value = ''
  result.value = null
  source.value = 'file'
  serverId.value = null
  projectId.value = null
  xmlFormId.value = null
  importingCentral.value = false
  landing.value = false
  centralError.value = null
  centralAttachments.value = []
  centralPublishedVersion.value = ''
  centralFormName.value = ''
  collisionRecord.value = null
}

const setSource = (next: ImportSource): void => {
  source.value = next
  centralError.value = null
}

const onCentralError = (err: unknown): void => {
  centralError.value = err
}

// --- File source ------------------------------------------------------------
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

// --- Central source: pull the published form into a parse result ------------
const pullFromCentral = async (): Promise<void> => {
  const s = serverId.value
  const p = projectId.value
  const f = xmlFormId.value
  if (s === null || p === null || f === null) return
  centralError.value = null
  importingCentral.value = true
  try {
    const pulled = await central.importFormFromCentral(s, p, f)
    centralAttachments.value = pulled.attachments
    centralPublishedVersion.value = pulled.document.settings.version ?? ''
    centralFormName.value = pulled.document.settings.formTitle ?? f
    fileName.value = centralFormName.value
    result.value = { kind: 'xform', document: pulled.document, issues: pulled.issues }
  } catch (err) {
    onCentralError(err)
  } finally {
    importingCentral.value = false
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

// --- File-source landing (attachment-less, unchanged) -----------------------
const importFileNow = async (): Promise<void> => {
  const doc = result.value?.document
  if (doc == null) return
  const record = await formsRepo.createForm(doc)
  visible.value = false
  reset()
  await router.push({ name: 'editor', params: { formId: record.id } })
}

// --- Central-source landing -------------------------------------------------
const seedTarget = async (formRecordId: string): Promise<void> => {
  const s = serverId.value
  const p = projectId.value
  const f = xmlFormId.value
  if (s === null || p === null || f === null) return
  await central.upsertTarget({
    formRecordId,
    serverId: s,
    projectId: p,
    xmlFormId: f,
    lastPublishedVersion: centralPublishedVersion.value,
    lastPublishedAt: Date.now(),
  })
}

const finishCentral = async (formRecordId: string): Promise<void> => {
  toast.add({
    severity: 'success',
    summary: t('central.import.imported', { name: centralFormName.value }),
    detail: t(
      'central.import.attachmentsPulled',
      { count: centralAttachments.value.length },
      centralAttachments.value.length
    ),
    life: 3000,
  })
  visible.value = false
  reset()
  await router.push({ name: 'editor', params: { formId: formRecordId } })
}

/** Run a landing that produces (or overwrites) a FormRecord, then seed the
 * origin publish target and navigate. Central failures surface via
 * `central.errors.*`, not the file-oriented copy. */
const landCentral = async (create: () => Promise<FormRecord>): Promise<void> => {
  landing.value = true
  try {
    const record = await create()
    await seedTarget(record.id)
    await finishCentral(record.id)
  } catch (err) {
    onCentralError(err)
  } finally {
    landing.value = false
  }
}

const landCopy = async (): Promise<void> => {
  const doc = result.value?.document
  if (doc == null) return
  collisionRecord.value = null
  await landCentral(() => formsRepo.createFormWithArchiveAttachments(doc, centralAttachments.value))
}

const landReplace = (): void => {
  const existing = collisionRecord.value
  const doc = result.value?.document
  if (existing == null || doc == null) return
  confirm.require({
    header: t('central.import.collisionTitle'),
    message: t('central.import.replaceConfirm', { name: existing.title }),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('central.import.replaceAccept'),
    rejectLabel: t('common.cancel'),
    acceptProps: { severity: 'danger' },
    accept: () => {
      void landCentral(() =>
        formsRepo.replaceFormWithArchiveAttachments(existing.id, doc, centralAttachments.value))
    },
  })
}

/** Footer confirm: file lands directly; Central checks for a formId collision
 * first, offering copy vs replace when one is found. */
const onConfirm = async (): Promise<void> => {
  if (source.value === 'file') {
    await importFileNow()
    return
  }
  const doc = result.value?.document
  if (doc == null) return
  const formId = doc.settings.formId ?? ''
  if (formId !== '') {
    const existing = (await formsRepo.listForms()).find((f) => f.formId === formId)
    if (existing !== undefined) {
      collisionRecord.value = existing
      return
    }
  }
  await landCopy()
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
    <div v-if="showSourceToggle && result === null" class="import-source">
      <span class="import-source-label">{{ t('central.import.sourceLabel') }}</span>
      <Button
        :label="t('central.import.sourceFile')"
        size="small"
        :severity="source === 'file' ? undefined : 'secondary'"
        :outlined="source !== 'file'"
        data-testid="import-source-file"
        @click="setSource('file')"
      />
      <Button
        :label="t('central.import.sourceCentral')"
        size="small"
        :severity="source === 'central' ? undefined : 'secondary'"
        :outlined="source !== 'central'"
        data-testid="import-source-central"
        @click="setSource('central')"
      />
    </div>

    <FileDropzone
      v-if="source === 'file' && result === null"
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

    <div
      v-else-if="source === 'central' && result === null"
      class="import-central"
      data-testid="import-central-form"
    >
      <p class="import-central-intro">{{ t('central.import.intro') }}</p>
      <div class="import-field">
        <label>{{ t('central.import.serverLabel') }}</label>
        <CentralServerPicker v-model="serverId" />
      </div>
      <div class="import-field">
        <label>{{ t('central.import.projectLabel') }}</label>
        <CentralProjectPicker v-model="projectId" :server-id="serverId" @error="onCentralError" />
      </div>
      <div class="import-field">
        <label>{{ t('central.import.formLabel') }}</label>
        <CentralFormPicker
          v-model="xmlFormId"
          :server-id="serverId"
          :project-id="projectId"
          published-only
          @error="onCentralError"
        />
        <small class="import-central-note">{{ t('central.import.publishedOnly') }}</small>
      </div>
      <p v-if="centralError !== null" class="import-error" data-testid="import-central-error">
        {{ t(centralErrorKey) }}
      </p>
      <div class="import-central-actions">
        <Button
          :label="t('central.import.confirm')"
          :loading="importingCentral"
          :disabled="xmlFormId === null"
          data-testid="import-central-confirm"
          @click="pullFromCentral"
        />
      </div>
    </div>

    <div v-else class="import-report" data-testid="import-report">
      <p class="import-summary">
        <strong>{{ fileName }}</strong> {{ summaryLine }}
        <template v-if="result?.issues.length === 0">{{ t('common.noProblems') }}</template>
        <template v-else>
          {{ problemCounts }}
        </template>
      </p>
      <ul v-if="result && result.issues.length > 0" class="import-issues">
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

      <div v-if="collisionPending" class="import-collision" data-testid="import-collision">
        <p class="import-collision-message">
          {{ t('central.import.collision', { formId: collisionRecord?.formId ?? '' }) }}
        </p>
        <div class="import-collision-actions">
          <Button
            :label="t('central.import.copy')"
            severity="secondary"
            :loading="landing"
            data-testid="import-collision-copy"
            @click="landCopy"
          />
          <Button
            :label="t('central.import.replace')"
            severity="danger"
            :loading="landing"
            data-testid="import-collision-replace"
            @click="landReplace"
          />
        </div>
      </div>

      <p v-if="centralError !== null" class="import-error" data-testid="import-central-error">
        {{ t(centralErrorKey) }}
      </p>
    </div>

    <template #footer>
      <Button
        v-if="result !== null && source === 'file'"
        :label="t('common.chooseAnotherFile')"
        severity="secondary"
        text
        @click="reset"
      />
      <Button :label="t('common.cancel')" severity="secondary" text @click="visible = false" />
      <Button
        v-if="result !== null && !collisionPending"
        :label="warnings.length > 0 ? t('importExport.import.confirmAnyway') : t('importExport.import.confirm')"
        :disabled="!canImport"
        :loading="landing"
        data-testid="import-confirm"
        @click="onConfirm"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.import-source {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  margin-bottom: var(--odk-spacing-m);
}

.import-source-label {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
  margin-inline-end: var(--odk-spacing-s);
}

.import-central {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
}

.import-central-intro {
  margin: 0;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.import-field {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.import-field label {
  font-size: var(--odk-hint-font-size);
  font-weight: 600;
}

.import-central-note {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.import-central-actions {
  display: flex;
  justify-content: flex-end;
}

.import-error {
  margin: 0;
  color: var(--odk-error-text-color);
  font-size: var(--odk-hint-font-size);
}

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

.import-collision {
  margin-top: var(--odk-spacing-m);
  padding-top: var(--odk-spacing-m);
  border-top: 1px solid var(--odk-border-color, var(--odk-light-background-color));
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.import-collision-message {
  margin: 0;
  font-size: var(--odk-hint-font-size);
}

.import-collision-actions {
  display: flex;
  gap: var(--odk-spacing-s);
  justify-content: flex-end;
}
</style>
