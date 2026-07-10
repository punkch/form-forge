<script lang="ts">
import type { QuestionTypeDefinition } from '@/core/registry/question-types'

/** Whether this section will render anything for the given type definition. */
export const hasTypeConfig = (def: QuestionTypeDefinition | undefined): boolean =>
  def !== undefined &&
  ((def.appearances?.length ?? 0) > 0 || (def.parameters?.length ?? 0) > 0 || def.requiresFile === true)
</script>

<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, ref } from 'vue'

import GuideTrigger from '@/components/help/GuideTrigger.vue'
import HelpPopover from '@/components/help/HelpPopover.vue'
import { useAttachmentUpload } from '@/composables/useAttachmentUpload'
import { datasetFormatOf, defaultDatasetParams } from '@/core/datasets/parse'
import { findNode } from '@/core/model/ops'
import type { FormNode } from '@/core/model/types'
import { effectiveItemsetFile as effectiveItemsetFileOf, getQuestionType, type QuestionTypeParameter } from '@/core/registry/question-types'
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ node: FormNode }>()

const { t } = useAppI18n()
const form = useFormStore()
const editor = useEditorStore()
const { attachFile } = useAttachmentUpload()

const def = computed(() => getQuestionType(props.node.kind === 'question' ? props.node.type : props.node.kind))

const appearanceOptions = computed(() =>
  (def.value?.appearances ?? []).map((a) => ({
    label: a.enketoSupported ? a.name : t('properties.typeConfig.collectOnly', { name: a.name }),
    value: a.name,
  }))
)

const setAppearance = (value: string | null): void => {
  form.updateNode(props.node.id, t('properties.typeConfig.undoEditAppearance'), (n) => {
    n.body.appearance = value === null || value === '' ? undefined : value
  })
}

const setParameter = (param: QuestionTypeParameter, value: string | undefined): void => {
  form.updateNode(props.node.id, t('properties.typeConfig.undoEditParameter', { name: param.name }), (n) => {
    const params = { ...n.body.parameters }
    if (value === undefined || value === '') delete params[param.name]
    else params[param.name] = value
    n.body.parameters = Object.keys(params).length > 0 ? params : undefined
  })
}

const paramValue = (param: QuestionTypeParameter): string =>
  props.node.body.parameters?.[param.name] ?? ''

/** Display-only sentence casing ("thousands-sep" → "Thousands sep"); keys stay verbatim. */
const paramLabel = (name: string): string => {
  const spaced = name.replace(/-/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

const setItemsetFile = (value: string): void => {
  form.updateNode(props.node.id, t('properties.typeConfig.undoEditChoicesFile'), (n) => {
    if (n.kind === 'question') n.itemsetFile = value === '' ? undefined : value
  })
}

// --- choices-file upload -----------------------------------------------------

const uploadInput = ref<HTMLInputElement | null>(null)
const renamedUpload = ref<{ original: string, storedAs: string } | null>(null)

/** Filename the serializer will reference: csv-external defaults to `${name}.csv`. */
const effectiveItemsetFile = computed<string | undefined>(() =>
  props.node.kind === 'question' ? effectiveItemsetFileOf(props.node) : undefined
)

const attachedFile = computed(() =>
  effectiveItemsetFile.value === undefined
    ? undefined
    : form.doc?.attachments.find((a) => a.filename === effectiveItemsetFile.value)
)

const uploadStatus = computed<'attached' | 'missing' | 'none'>(() =>
  attachedFile.value !== undefined ? 'attached' : effectiveItemsetFile.value !== undefined ? 'missing' : 'none'
)

// --- dataset columns ---------------------------------------------------------

/** The value/label parameters of from-file selects name dataset columns. */
const isColumnParam = (param: QuestionTypeParameter): boolean =>
  def.value?.requiresFile === true && (param.name === 'value' || param.name === 'label')

/**
 * Parsed columns of the question's effective file (undefined while unknown:
 * not attached, not parsed yet, or unparseable — the inputs then stay free
 * text).
 */
const datasetColumnOptions = computed<string[] | undefined>(() => {
  const file = effectiveItemsetFile.value
  if (file === undefined) return undefined
  const columns = form.datasetColumnsByFilename.get(file)
  return columns === undefined || columns === null || columns.length === 0
    ? undefined
    : [...columns]
})

/** Column params show the per-format ODK default (geojson: id/title). */
const paramPlaceholder = (param: QuestionTypeParameter): string => {
  if (isColumnParam(param) && effectiveItemsetFile.value !== undefined) {
    const format = datasetFormatOf(effectiveItemsetFile.value)
    if (format === 'csv' || format === 'geojson') {
      return defaultDatasetParams(format)[param.name as 'value' | 'label']
    }
  }
  return param.defaultValue !== undefined ? String(param.defaultValue) : ''
}

const viewFile = (): void => {
  if (effectiveItemsetFile.value !== undefined) editor.openDatasetPreview(effectiveItemsetFile.value)
}

const uploadFile = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file === undefined || props.node.kind !== 'question') return
  renamedUpload.value = null
  const nodeId = props.node.id
  const expected = props.node.itemsetFile
  if (expected === undefined) {
    // Adopt the uploaded file's own name — one undo step covers ref + itemsetFile.
    await attachFile(file, undefined, {
      undoLabel: t('properties.typeConfig.undoUploadChoicesFile'),
      alsoMutate: (d) => {
        const n = findNode(d, nodeId)
        if (n !== null && n.kind === 'question') n.itemsetFile = file.name
      },
    })
  } else {
    // Store under the name the question expects so the preview/export find it.
    if (file.name !== expected) renamedUpload.value = { original: file.name, storedAs: expected }
    await attachFile(file, expected, { undoLabel: t('properties.typeConfig.undoUploadChoicesFile') })
  }
}
</script>

<template>
  <section v-if="def && hasTypeConfig(def)" class="prop-section">
    <label v-if="(def.appearances?.length ?? 0) > 0" class="prop-field">
      <span>{{ t('properties.typeConfig.appearance') }}<HelpPopover field="appearance" /></span>
      <Select
        :model-value="node.body.appearance ?? null"
        :options="appearanceOptions"
        option-label="label"
        option-value="value"
        editable
        show-clear
        :placeholder="t('properties.typeConfig.appearancePlaceholder')"
        data-testid="prop-appearance"
        @update:model-value="setAppearance"
      />
    </label>

    <div v-if="def.requiresFile && node.kind === 'question'" class="prop-field">
      <!-- The external-datasets guide "?" also sits on the choice-based
           Choices section; the two never co-render (requiresFile and
           requiresChoices are mutually exclusive), so the testid is unique.
           This block is a <div>, not a <label>, so a real button is safe. -->
      <span>{{ t('properties.typeConfig.choicesFile') }}<HelpPopover field="itemsetFile" /> <GuideTrigger guide="datasets" /></span>
      <InputText
        :model-value="node.itemsetFile ?? ''"
        :placeholder="effectiveItemsetFile ?? t('properties.typeConfig.choicesFilePlaceholder')"
        data-testid="prop-itemset-file"
        @update:model-value="setItemsetFile($event ?? '')"
      />
      <div
        class="itemset-status"
        :class="uploadStatus === 'attached' ? 'itemset-attached' : 'itemset-missing'"
        :data-state="uploadStatus"
        data-testid="prop-itemset-status"
      >
        <i :class="uploadStatus === 'attached' ? 'pi pi-check-circle' : 'pi pi-exclamation-triangle'" />
        <span v-if="uploadStatus === 'attached'">{{ t('properties.typeConfig.fileAttached', { filename: effectiveItemsetFile }) }}</span>
        <span v-else-if="uploadStatus === 'missing'">{{ t('properties.typeConfig.fileMissing', { filename: effectiveItemsetFile }) }}</span>
        <span v-else>{{ t('properties.typeConfig.fileNone') }}</span>
      </div>
      <p v-if="renamedUpload" class="itemset-renamed" data-testid="prop-itemset-renamed">
        {{ t('properties.typeConfig.storedAs', { stored: renamedUpload.storedAs, original: renamedUpload.original }) }}
      </p>
      <input
        ref="uploadInput"
        type="file"
        accept=".csv,.xml,.geojson"
        class="itemset-upload-input"
        data-testid="prop-itemset-upload-input"
        @change="uploadFile"
      >
      <div class="itemset-actions">
        <Button
          :label="uploadStatus === 'attached' ? t('properties.typeConfig.replaceFile') : t('properties.typeConfig.uploadFile')"
          icon="pi pi-upload"
          size="small"
          severity="secondary"
          outlined
          data-testid="prop-itemset-upload"
          @click="uploadInput?.click()"
        />
        <Button
          v-if="uploadStatus === 'attached'"
          :label="t('properties.typeConfig.viewFile')"
          icon="pi pi-table"
          size="small"
          severity="secondary"
          outlined
          data-testid="prop-itemset-view"
          @click="viewFile"
        />
      </div>
    </div>

    <template v-for="param in def.parameters ?? []" :key="param.name">
      <label v-if="param.type === 'boolean'" class="prop-toggle">
        <Checkbox
          :model-value="paramValue(param) === 'true'"
          binary
          :data-testid="`prop-param-${param.name}`"
          @update:model-value="setParameter(param, $event === true ? 'true' : undefined)"
        />
        <span v-tooltip.left="param.description">{{ paramLabel(param.name) }}<HelpPopover field="parameters" /></span>
      </label>
      <label v-else class="prop-field">
        <span v-tooltip.left="param.description">{{ paramLabel(param.name) }}<template v-if="param.required"> *</template><HelpPopover field="parameters" /></span>
        <Select
          v-if="param.options"
          :model-value="paramValue(param) === '' ? null : paramValue(param)"
          :options="param.options"
          show-clear
          :placeholder="String(param.defaultValue ?? '')"
          :data-testid="`prop-param-${param.name}`"
          @update:model-value="setParameter(param, $event ?? undefined)"
        />
        <Select
          v-else-if="isColumnParam(param) && datasetColumnOptions"
          :model-value="paramValue(param) === '' ? null : paramValue(param)"
          :options="datasetColumnOptions"
          editable
          show-clear
          :placeholder="paramPlaceholder(param)"
          :data-testid="`prop-param-${param.name}`"
          @update:model-value="setParameter(param, ($event as string | null) ?? undefined)"
        />
        <InputText
          v-else
          :model-value="paramValue(param)"
          :placeholder="paramPlaceholder(param)"
          :data-testid="`prop-param-${param.name}`"
          @update:model-value="setParameter(param, $event ?? undefined)"
        />
      </label>
    </template>
  </section>
</template>

<style scoped>
@import './prop-section.css';

.itemset-status {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  font-size: var(--odk-hint-font-size);
}

.itemset-attached {
  color: var(--odk-success-text-color);
}

.itemset-missing {
  color: var(--odk-warning-text-color);
}

.itemset-renamed {
  margin: 0;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.itemset-upload-input {
  display: none;
}

.itemset-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--odk-spacing-s);
}
</style>
