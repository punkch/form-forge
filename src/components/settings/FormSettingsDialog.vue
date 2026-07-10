<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { computed } from 'vue'

import ExpressionInput from '@/components/properties/ExpressionInput.vue'
import type { FormSettings } from '@/core/model/types'
import { useAppI18n } from '@/i18n'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const { t } = useAppI18n()
const form = useFormStore()
const editor = useEditorStore()

const visible = computed({
  get: () => editor.activeDialog === 'settings',
  set: (open: boolean) => { editor.activeDialog = open ? 'settings' : null },
})

const settings = computed(() => form.doc?.settings)

const set = <K extends keyof FormSettings>(key: K, value: FormSettings[K]): void => {
  form.mutate(t('settings.dialog.undoEdit', { key: String(key) }), (d) => {
    if (value === '' || value === undefined) delete d.settings[key]
    else d.settings[key] = value
  }, { coalesce: true })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :header="t('settings.dialog.header')"
    modal
    :style="{ width: '34rem' }"
    data-testid="settings-dialog"
  >
    <div v-if="settings" class="settings-fields">
      <label class="prop-field">
        <span>{{ t('settings.dialog.formTitle') }}</span>
        <InputText
          :model-value="settings.formTitle ?? ''"
          data-testid="setting-form-title"
          @update:model-value="set('formTitle', $event ?? '')"
        />
      </label>
      <div class="settings-row">
        <label class="prop-field grow">
          <span>{{ t('settings.dialog.formId') }}</span>
          <InputText
            :model-value="settings.formId ?? ''"
            class="mono"
            data-testid="setting-form-id"
            @update:model-value="set('formId', $event ?? '')"
          />
        </label>
        <label class="prop-field grow">
          <span>{{ t('settings.dialog.version') }}</span>
          <InputText
            :model-value="settings.version ?? ''"
            class="mono"
            data-testid="setting-version"
            @update:model-value="set('version', $event ?? '')"
          />
        </label>
      </div>
      <label class="prop-field">
        <span>{{ t('settings.dialog.instanceName') }}</span>
        <ExpressionInput
          :model-value="settings.instanceName ?? ''"
          field="instanceName"
          node-id=""
          :placeholder="t('settings.dialog.instanceNamePlaceholder')"
          @update:model-value="set('instanceName', $event)"
        />
      </label>
      <label class="prop-field">
        <span>{{ t('settings.dialog.style') }}</span>
        <InputText
          :model-value="settings.style ?? ''"
          :placeholder="t('settings.dialog.stylePlaceholder')"
          data-testid="setting-style"
          @update:model-value="set('style', $event ?? '')"
        />
      </label>
      <label class="prop-field">
        <span>{{ t('settings.dialog.submissionUrl') }}</span>
        <InputText
          :model-value="settings.submissionUrl ?? ''"
          :placeholder="t('settings.dialog.submissionUrlPlaceholder')"
          @update:model-value="set('submissionUrl', $event ?? '')"
        />
      </label>
      <label class="prop-field">
        <span>{{ t('settings.dialog.publicKey') }}</span>
        <InputText
          :model-value="settings.publicKey ?? ''"
          class="mono"
          @update:model-value="set('publicKey', $event ?? '')"
        />
      </label>
      <label class="settings-toggle">
        <Checkbox
          :model-value="settings.allowChoiceDuplicates === true"
          binary
          @update:model-value="set('allowChoiceDuplicates', $event === true ? true : undefined)"
        />
        <span>{{ t('settings.dialog.allowChoiceDuplicates') }}</span>
      </label>
    </div>
  </Dialog>
</template>

<style scoped>
@import '../properties/prop-section.css';

.settings-fields {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-l);
}

.settings-row {
  display: flex;
  gap: var(--odk-spacing-l);
}

.grow {
  flex: 1;
}

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}

.settings-toggle {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  font-size: var(--odk-hint-font-size);
}
</style>
