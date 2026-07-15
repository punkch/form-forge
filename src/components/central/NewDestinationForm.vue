<script setup lang="ts">
/**
 * The Central drawer's "Publish to a new destination" collapsible. Expands
 * inline below the tracked-destinations list (no modal, no panel swap) so the
 * list stays in view while you add another destination.
 *
 * Picks a server + project, then either creates a new Central form under the
 * current form id (the default) or updates an existing form chosen from the
 * project. Emits the resolved destination; the drawer runs the publish flow and,
 * on success, records it as a tracked destination.
 */
import Button from 'primevue/button'
import Message from 'primevue/message'
import RadioButton from 'primevue/radiobutton'
import { computed, ref, watch } from 'vue'

import CentralFormPicker from '@/components/central/CentralFormPicker.vue'
import CentralProjectPicker from '@/components/central/CentralProjectPicker.vue'
import CentralServerPicker from '@/components/central/CentralServerPicker.vue'
import type { PublishDestination } from '@/composables/usePublishFlow'
import { useAppI18n } from '@/i18n'
import { centralErrorKey } from '@/i18n/central-errors'
import { useFormStore } from '@/stores/form'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ busy: boolean }>()
const emit = defineEmits<{ submit: [destination: PublishDestination] }>()

const { t } = useAppI18n()
const form = useFormStore()

const serverId = ref<string | null>(null)
const projectId = ref<number | null>(null)
/** 'create' → a new Central form under the current form id; 'update' → an
 * existing form picked from the project. */
const target = ref<'create' | 'update'>('create')
const existingFormId = ref<string | null>(null)
const errorText = ref('')

const currentFormId = computed(() => form.doc?.settings.formId ?? '')

const xmlFormId = computed(() =>
  target.value === 'create' ? currentFormId.value : (existingFormId.value ?? ''))

const canPublish = computed(() =>
  !props.busy && serverId.value !== null && projectId.value !== null && xmlFormId.value !== '')

// A project change invalidates a stale existing-form choice.
watch(projectId, () => { existingFormId.value = null })

const onCentralError = (error: unknown): void => { errorText.value = t(centralErrorKey(error)) }

const collapse = (): void => { open.value = false }

const publish = (): void => {
  if (serverId.value === null || projectId.value === null || xmlFormId.value === '') return
  emit('submit', {
    serverId: serverId.value,
    projectId: projectId.value,
    xmlFormId: xmlFormId.value,
    mode: target.value,
  })
}
</script>

<template>
  <div class="new-destination">
    <Button
      v-if="!open"
      icon="pi pi-plus"
      :label="t('central.drawer.newDestination')"
      severity="secondary"
      text
      data-testid="central-new-destination-toggle"
      @click="open = true"
    />

    <div v-else class="new-destination-form" data-testid="central-new-destination">
      <p class="new-destination-title">{{ t('central.drawer.newDestination') }}</p>

      <CentralServerPicker v-model="serverId" />
      <CentralProjectPicker
        v-model="projectId"
        :server-id="serverId"
        @error="onCentralError"
      />

      <div class="new-destination-mode">
        <label class="mode-option">
          <RadioButton v-model="target" value="create" data-testid="central-new-create" />
          <span>{{ t('central.drawer.createNewForm', { formId: currentFormId }) }}</span>
        </label>
        <label class="mode-option">
          <RadioButton v-model="target" value="update" data-testid="central-new-update" />
          <span>{{ t('central.drawer.updateExistingForm') }}</span>
        </label>
      </div>

      <CentralFormPicker
        v-if="target === 'update'"
        v-model="existingFormId"
        :server-id="serverId"
        :project-id="projectId"
        @error="onCentralError"
      />

      <Message v-if="errorText !== ''" severity="error" data-testid="central-new-error">
        {{ errorText }}
      </Message>

      <div class="new-destination-actions">
        <Button
          :label="t('central.drawer.newDestinationCollapse')"
          severity="secondary"
          text
          @click="collapse"
        />
        <Button
          :label="t('central.drawer.publishHere')"
          icon="pi pi-cloud-upload"
          :disabled="!canPublish"
          data-testid="central-new-publish"
          @click="publish"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.new-destination-form {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
  padding: var(--odk-spacing-m);
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
  background: var(--odk-base-background-color);
}

.new-destination-title {
  margin: 0;
  font-weight: 600;
}

.new-destination-mode {
  display: flex;
  flex-direction: column;
  gap: var(--builder-spacing-xs);
}

.mode-option {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
  cursor: pointer;
}

.new-destination-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--odk-spacing-s);
}
</style>
