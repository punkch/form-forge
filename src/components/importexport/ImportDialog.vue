<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'

import { parseFormFile, type ImportParseResult } from '@/core/import-form'
import { isSheetScope, type Issue } from '@/core/validate'
import * as formsRepo from '@/persistence/forms-repo'

const visible = defineModel<boolean>('visible', { required: true })

const router = useRouter()

const parsing = ref(false)
const fileName = ref('')
// shallowRef: the parsed FormDocument goes straight into IndexedDB, and a
// deep-reactive proxy would fail structured cloning (DataCloneError).
const result = shallowRef<ImportParseResult | null>(null)
const dragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

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
        message: `Could not read "${file.name}": ${String(error)}`,
        scope: {},
      }],
    }
  } finally {
    parsing.value = false
  }
}

const onPick = (event: Event): void => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file !== undefined) void handleFile(file)
}

const onDrop = (event: DragEvent): void => {
  dragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file !== undefined) void handleFile(file)
}

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
    header="Import a form"
    modal
    :style="{ width: '38rem' }"
    @hide="reset"
  >
    <div
      v-if="result === null"
      class="import-dropzone"
      :class="{ over: dragOver }"
      data-testid="import-dropzone"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="onDrop"
    >
      <i class="pi pi-upload" />
      <p>Drop an XForm (.xml) or XLSForm (.xlsx) here</p>
      <Button
        label="Choose a file"
        severity="secondary"
        :loading="parsing"
        data-testid="import-pick"
        @click="fileInput?.click()"
      />
      <input
        ref="fileInput"
        type="file"
        accept=".xml,.xlsx,.xls"
        class="import-file-input"
        data-testid="import-file-input"
        @change="onPick"
      >
    </div>

    <div v-else class="import-report" data-testid="import-report">
      <p class="import-summary">
        <strong>{{ fileName }}</strong> — read as {{ result.kind === 'xlsform' ? 'XLSForm' : 'XForm XML' }}.
        <template v-if="result.issues.length === 0">No problems found.</template>
        <template v-else>
          {{ errors.length }} error{{ errors.length === 1 ? '' : 's' }},
          {{ warnings.length }} warning{{ warnings.length === 1 ? '' : 's' }}.
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
        Fix these errors in the source file and try again.
      </p>
    </div>

    <template #footer>
      <Button
        v-if="result !== null"
        label="Choose another file"
        severity="secondary"
        text
        @click="reset"
      />
      <Button label="Cancel" severity="secondary" text @click="visible = false" />
      <Button
        :label="warnings.length > 0 ? 'Import anyway' : 'Import'"
        :disabled="!canImport"
        data-testid="import-confirm"
        @click="importNow"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.import-dropzone {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--odk-spacing-m);
  padding: var(--odk-spacing-xxl);
  border: 2px dashed var(--odk-border-color);
  border-radius: var(--odk-radius);
  color: var(--odk-muted-text-color);
  text-align: center;
}

.import-dropzone.over {
  border-color: var(--odk-primary-border-color);
  background: var(--odk-primary-lighter-background-color);
}

.import-dropzone i {
  font-size: 2rem;
}

.import-file-input {
  display: none;
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
  margin-right: 4px;
}

.import-blocked {
  margin: var(--odk-spacing-m) 0 0;
  color: var(--odk-error-text-color);
  font-size: var(--odk-hint-font-size);
}
</style>
