<script setup lang="ts">
/**
 * Import a form from a file: XLSForm (`.xlsx`/`.xls`), XForm (`.xml`), or a
 * per-form ZIP bundle (`.zip`, produced by `exportZip` — `form.xml`/`form.xlsx`
 * plus `media/<filename>`).
 *
 * Central import moved out of this dialog into the library-level Central drawer
 * (`LibraryCentralDrawer.vue`). The bare-file path never touched attachments,
 * so it stays a simple create-and-open. A ZIP bundle carries attachments, so it
 * lands through the same archive-attachment primitives as Central import and
 * offers the same formId-collision Copy/Replace prompt (shared
 * `ImportCollisionPanel`).
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import { useConfirm } from 'primevue/useconfirm'
import { computed, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'

import FileDropzone from '@/components/importexport/FileDropzone.vue'
import ImportCollisionPanel from '@/components/importexport/ImportCollisionPanel.vue'
import ImportReport from '@/components/importexport/ImportReport.vue'
import { useImportLanding } from '@/composables/useImportLanding'
import { parseFormFile, type ImportParseResult } from '@/core/import-form'
import { useAppI18n } from '@/i18n'
import * as formsRepo from '@/persistence/forms-repo'

const { t } = useAppI18n()

const visible = defineModel<boolean>('visible', { required: true })

const router = useRouter()
const confirm = useConfirm()

const parsing = ref(false)
const fileName = ref('')
// shallowRef: the parsed FormDocument goes straight into IndexedDB, and a
// deep-reactive proxy would fail structured cloning (DataCloneError).
const result = shallowRef<ImportParseResult | null>(null)
const landError = ref<unknown>(null)

const { landing, collisionRecord, collisionPending, land, landOrCollide, reset: resetLanding } =
  useImportLanding({
    isActive: () => visible.value,
    onLanded: async (record) => {
      visible.value = false
      reset()
      await router.push({ name: 'editor', params: { formId: record.id } })
    },
    onError: (err) => { landError.value = err },
  })

const errors = computed(() => result.value?.issues.filter((i) => i.severity === 'error') ?? [])
const warnings = computed(() => result.value?.issues.filter((i) => i.severity !== 'error') ?? [])
const canImport = computed(() => result.value?.document != null && errors.value.length === 0)

const reset = (): void => {
  parsing.value = false
  fileName.value = ''
  result.value = null
  landError.value = null
  resetLanding()
}

const handleFile = async (file: File): Promise<void> => {
  parsing.value = true
  fileName.value = file.name
  landError.value = null
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

const landCopy = async (): Promise<void> => {
  const doc = result.value?.document
  const attachments = result.value?.attachments
  if (doc == null || attachments === undefined) return
  await land(() => formsRepo.createFormWithArchiveAttachments(doc, attachments))
}

const landReplace = (): void => {
  const existing = collisionRecord.value
  const doc = result.value?.document
  const attachments = result.value?.attachments
  if (existing == null || doc == null || attachments === undefined) return
  confirm.require({
    header: t('importExport.import.collisionTitle'),
    message: t('importExport.import.replaceConfirm', { name: existing.title }),
    icon: 'pi pi-exclamation-triangle',
    acceptLabel: t('importExport.import.replaceAccept'),
    rejectLabel: t('common.cancel'),
    acceptProps: { severity: 'danger' },
    accept: () => {
      void land(() => formsRepo.replaceFormWithArchiveAttachments(existing.id, doc, attachments))
    },
  })
}

const onConfirm = async (): Promise<void> => {
  const doc = result.value?.document
  if (doc == null) return
  const attachments = result.value?.attachments
  if (attachments === undefined) {
    // Bare .xml/.xlsx never carries attachments (the field is the bundle
    // marker) and never prompts about collisions — plain create-and-open.
    await land(() => formsRepo.createForm(doc))
    return
  }
  // ZIP bundle: a formId already in the library offers copy vs replace, else copy.
  await landOrCollide(
    doc.settings.formId ?? '',
    () => formsRepo.createFormWithArchiveAttachments(doc, attachments)
  )
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
      accept=".xml,.xlsx,.xls,.zip"
      icon="pi pi-upload"
      :hint="t('importExport.import.dropHint')"
      :choose-label="t('common.chooseFile')"
      :loading="parsing"
      drop-testid="import-dropzone"
      pick-testid="import-pick"
      input-testid="import-file-input"
      @file="handleFile"
    />

    <template v-else>
      <ImportReport :result="result" :name="fileName" />

      <ImportCollisionPanel
        v-if="collisionPending"
        :message="t('importExport.import.collision', { formId: collisionRecord?.formId ?? '' })"
        :copy-label="t('importExport.import.copy')"
        :replace-label="t('importExport.import.replace')"
        :landing="landing"
        testid-prefix="import-collision"
        @copy="landCopy"
        @replace="landReplace"
      />

      <Message v-if="landError !== null" severity="error" data-testid="import-landing-error">
        {{ t('importExport.import.landFailed', { error: String(landError) }) }}
      </Message>
    </template>

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
