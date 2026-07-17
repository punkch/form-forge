<script setup lang="ts">
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed } from 'vue'

import AttachmentConflictDialog from '@/components/attachments/AttachmentConflictDialog.vue'
import HelpPopover from '@/components/help/HelpPopover.vue'
import AttachmentPicker from '@/components/properties/AttachmentPicker.vue'
import LabelMediaSection from '@/components/properties/LabelMediaSection.vue'
import LocalizedInput from '@/components/properties/LocalizedInput.vue'
import { useMediaAttachment } from '@/composables/useMediaAttachment'
import { imageDefaultFilename, isDynamicDefault } from '@/core/model/defaults'
import { setText } from '@/core/model/display'
import { findNode } from '@/core/model/ops'
import type { FormNode, Lang } from '@/core/model/types'
import { getQuestionType } from '@/core/registry/question-types'
import { useAppI18n } from '@/i18n'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ node: FormNode }>()

const { t } = useAppI18n()
const form = useFormStore()
const { conflictFile, resolveConflict, uploadSingle, attachedFilenames } = useMediaAttachment()

const def = computed(() => getQuestionType(props.node.kind === 'question' ? props.node.type : props.node.kind))
const isMeta = computed(() => def.value?.category === 'meta')
const isCalculate = computed(() => props.node.kind === 'question' && props.node.type === 'calculate')
const showLabel = computed(() => !isMeta.value && !isCalculate.value)

// The image type's `default` names an annotate/draw/signature template
// attachment (pyxform prefixes it to jr://images/<file> at serialize time,
// appearance-independent) — an attachment picker, not free text, unless the
// stored value is a dynamic expression (a legacy/hand-authored escape hatch
// that stays a plain InputText).
const isImageQuestion = computed(() => props.node.kind === 'question' && props.node.type === 'image')
const isImageDefaultPickable = computed(() =>
  isImageQuestion.value && (props.node.defaultValue === undefined || !isDynamicDefault(props.node.defaultValue))
)
const defaultImageFilename = computed(() =>
  props.node.kind === 'question' ? imageDefaultFilename(props.node) ?? null : null
)
const defaultImageMissing = computed(() =>
  defaultImageFilename.value !== null && !attachedFilenames.value.has(defaultImageFilename.value)
)

const pickDefaultImage = (filename: string | null): void => {
  form.updateNode(props.node.id, t('properties.basic.undoEditDefault'), (n) => {
    n.defaultValue = filename ?? undefined
  })
}

const uploadDefaultImage = async (file: File): Promise<void> => {
  const nodeId = props.node.id
  await uploadSingle(file, t('properties.basic.undoUploadDefault'), (d, storedAs) => {
    const n = findNode(d, nodeId)
    if (n !== null && n.kind === 'question') n.defaultValue = storedAs
  })
}

const nameIssues = computed(() =>
  (form.issuesByNode.get(props.node.id) ?? []).filter((i) => i.code.startsWith('name.'))
)

// Localized edits write the language the input displayed (LocalizedInput emits it).
const setLabel = (value: string, lang: Lang): void => {
  form.updateNode(props.node.id, t('properties.basic.undoEditLabel'), (n) => { n.label = setText(n.label, value, lang) })
}

const setName = (value: string): void => {
  form.updateNode(props.node.id, t('properties.basic.undoEditName'), (n) => { n.name = value })
}

const setHint = (value: string, lang: Lang): void => {
  form.updateNode(props.node.id, t('properties.basic.undoEditHint'), (n) => { n.hint = setText(n.hint, value, lang) })
}

const setGuidanceHint = (value: string, lang: Lang): void => {
  form.updateNode(props.node.id, t('properties.basic.undoEditGuidanceHint'), (n) => {
    n.guidanceHint = setText(n.guidanceHint, value, lang)
  })
}

const setDefault = (value: string): void => {
  form.updateNode(props.node.id, t('properties.basic.undoEditDefault'), (n) => {
    n.defaultValue = value === '' ? undefined : value
  })
}

const setRequired = (value: boolean): void => {
  form.updateNode(props.node.id, t('properties.basic.undoToggleRequired'), (n) => {
    n.bind.required = value ? 'true()' : undefined
  })
}

const setReadonly = (value: boolean): void => {
  form.updateNode(props.node.id, t('properties.basic.undoToggleReadOnly'), (n) => {
    n.bind.readonly = value ? 'true()' : undefined
  })
}
</script>

<template>
  <section class="prop-section">
    <label v-if="showLabel" class="prop-field">
      <span>{{ t('properties.basic.label') }}<HelpPopover field="label" /></span>
      <LocalizedInput
        :value="node.label"
        multiline
        data-testid="prop-label"
        @edit="setLabel"
      />
    </label>

    <label class="prop-field">
      <span>{{ t('properties.basic.name') }}<HelpPopover field="name" /></span>
      <InputText
        :model-value="node.name"
        :invalid="nameIssues.length > 0"
        class="prop-name-input"
        data-testid="prop-name"
        @update:model-value="setName($event ?? '')"
      />
      <small v-for="(issue, i) in nameIssues" :key="i" class="prop-issue">{{ issue.message }}</small>
    </label>

    <label v-if="showLabel" class="prop-field">
      <span>{{ t('properties.basic.hint') }}<HelpPopover field="hint" /></span>
      <LocalizedInput
        :value="node.hint"
        data-testid="prop-hint"
        @edit="setHint"
      />
    </label>

    <label v-if="showLabel" class="prop-field">
      <span>{{ t('properties.basic.guidanceHint') }}<HelpPopover field="guidanceHint" /></span>
      <LocalizedInput
        :value="node.guidanceHint"
        data-testid="prop-guidance-hint"
        @edit="setGuidanceHint"
      />
    </label>

    <LabelMediaSection v-if="showLabel" :node="node" />

    <div v-if="node.kind === 'question' && !isMeta" class="prop-field">
      <span>{{ t('properties.basic.defaultValue') }}<HelpPopover :field="isImageDefaultPickable ? 'defaultImage' : 'defaultValue'" /></span>
      <template v-if="isImageDefaultPickable">
        <AttachmentPicker
          :filename="defaultImageFilename"
          kind="image"
          :missing="defaultImageMissing"
          :varies="false"
          testid-prefix="prop-default-image"
          @pick="pickDefaultImage"
          @upload="uploadDefaultImage"
        />
        <small class="prop-default-image-hint">{{ t('properties.basic.defaultImageHint') }}</small>
      </template>
      <InputText
        v-else
        :model-value="node.defaultValue ?? ''"
        data-testid="prop-default"
        @update:model-value="setDefault($event ?? '')"
      />
    </div>

    <div v-if="node.kind === 'question' && !isMeta && !isCalculate" class="prop-toggles">
      <label class="prop-toggle">
        <ToggleSwitch
          :model-value="node.bind.required !== undefined"
          data-testid="prop-required"
          @update:model-value="setRequired"
        />
        <span>{{ t('properties.basic.required') }}<HelpPopover field="required" /></span>
      </label>
      <label class="prop-toggle">
        <ToggleSwitch
          :model-value="node.bind.readonly !== undefined"
          data-testid="prop-readonly"
          @update:model-value="setReadonly"
        />
        <span>{{ t('properties.basic.readOnly') }}<HelpPopover field="readOnly" /></span>
      </label>
    </div>

    <AttachmentConflictDialog :file="conflictFile" :remaining="0" @resolve="resolveConflict" />
  </section>
</template>

<style scoped>
@import './prop-section.css';

.prop-default-image-hint {
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}
</style>
