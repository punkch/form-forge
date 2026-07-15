<script setup lang="ts">
/**
 * Import a form from a file (XLSForm `.xlsx`/`.xls` or XForm `.xml`).
 *
 * Central import moved out of this dialog into the library-level Central drawer
 * (`LibraryCentralDrawer.vue`), so this surface is now single-purpose: pick a
 * file, show the parse report, and land it. The file path never touched
 * attachments, so it stays a simple create-and-open.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'

import FileDropzone from '@/components/importexport/FileDropzone.vue'
import ImportReport from '@/components/importexport/ImportReport.vue'
import { parseFormFile, type ImportParseResult } from '@/core/import-form'
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

const onConfirm = async (): Promise<void> => {
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

    <ImportReport v-else :result="result" :name="fileName" />

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
        v-if="result !== null"
        :label="warnings.length > 0 ? t('importExport.import.confirmAnyway') : t('importExport.import.confirm')"
        :disabled="!canImport"
        data-testid="import-confirm"
        @click="onConfirm"
      />
    </template>
  </Dialog>
</template>
