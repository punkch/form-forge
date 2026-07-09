<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { computed } from 'vue'

import ExpressionInput from '@/components/properties/ExpressionInput.vue'
import type { FormSettings } from '@/core/model/types'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const form = useFormStore()
const editor = useEditorStore()

const visible = computed({
  get: () => editor.activeDialog === 'settings',
  set: (open: boolean) => { editor.activeDialog = open ? 'settings' : null },
})

const settings = computed(() => form.doc?.settings)

const set = <K extends keyof FormSettings>(key: K, value: FormSettings[K]): void => {
  form.mutate(`Edit ${String(key)}`, (d) => {
    if (value === '' || value === undefined) delete d.settings[key]
    else d.settings[key] = value
  }, { coalesce: true })
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    header="Form settings"
    modal
    :style="{ width: '34rem' }"
    data-testid="settings-dialog"
  >
    <div v-if="settings" class="settings-fields">
      <label class="prop-field">
        <span>Form title</span>
        <InputText
          :model-value="settings.formTitle ?? ''"
          data-testid="setting-form-title"
          @update:model-value="set('formTitle', $event ?? '')"
        />
      </label>
      <div class="settings-row">
        <label class="prop-field grow">
          <span>Form ID</span>
          <InputText
            :model-value="settings.formId ?? ''"
            class="mono"
            data-testid="setting-form-id"
            @update:model-value="set('formId', $event ?? '')"
          />
        </label>
        <label class="prop-field grow">
          <span>Version</span>
          <InputText
            :model-value="settings.version ?? ''"
            class="mono"
            data-testid="setting-version"
            @update:model-value="set('version', $event ?? '')"
          />
        </label>
      </div>
      <label class="prop-field">
        <span>Instance name (expression naming each submission)</span>
        <ExpressionInput
          :model-value="settings.instanceName ?? ''"
          field="instanceName"
          node-id=""
          placeholder="e.g. concat(${name}, ' — ', ${today})"
          @update:model-value="set('instanceName', $event)"
        />
      </label>
      <label class="prop-field">
        <span>Style</span>
        <InputText
          :model-value="settings.style ?? ''"
          placeholder="e.g. pages"
          data-testid="setting-style"
          @update:model-value="set('style', $event ?? '')"
        />
      </label>
      <label class="prop-field">
        <span>Submission URL</span>
        <InputText
          :model-value="settings.submissionUrl ?? ''"
          placeholder="https://…"
          @update:model-value="set('submissionUrl', $event ?? '')"
        />
      </label>
      <label class="prop-field">
        <span>Public key (submission encryption)</span>
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
        <span>Allow duplicate choice names within a list</span>
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
