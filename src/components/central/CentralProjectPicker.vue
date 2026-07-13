<script setup lang="ts">
/**
 * Project dropdown for a chosen server. Fetches the project list from Central
 * (`central.listProjects`) whenever the server changes — an explicit,
 * user-initiated network read — and resets so a prior server's projects never
 * leak across opens. Surfaces the connection status and re-throws transport
 * failures to the parent via an `error` event (mapped to `central.errors.*`
 * there; the picker itself never localizes a `CentralError`).
 */
import Select from 'primevue/select'

import { connectionLabel } from '@/components/central/connection'
import { useCentralList } from '@/composables/useCentralList'
import type { CentralProject } from '@/core/central/types'
import { useAppI18n } from '@/i18n'
import { useCentralStore } from '@/stores/central'

const props = defineProps<{ serverId: string | null, modelValue: number | null }>()
const emit = defineEmits<{
  'update:modelValue': [value: number | null]
  error: [error: unknown]
}>()

const central = useCentralStore()
const { t } = useAppI18n()

// Reset + refetch on every server change (including back to null on dialog
// hide). A valid pre-fill (the publish dialog pre-selecting a remembered
// target) survives the refetch instead of being nulled on every server change.
const { items: projects, loading } = useCentralList<CentralProject, string | null>({
  deps: () => props.serverId,
  ready: (serverId) => serverId !== null,
  fetch: (serverId) => central.listProjects(serverId!),
  selectionValid: (fetched) => props.modelValue === null || fetched.some((p) => p.id === props.modelValue),
  clearSelection: () => { if (props.modelValue !== null) emit('update:modelValue', null) },
  onError: (error) => emit('error', error),
})

const onChange = (value: number | null): void => { emit('update:modelValue', value) }
</script>

<template>
  <div class="central-project-picker">
    <Select
      :model-value="modelValue"
      :options="projects"
      option-label="name"
      option-value="id"
      :loading="loading"
      :disabled="serverId === null"
      :placeholder="t('central.publish.projectPlaceholder')"
      :empty-message="t('central.publish.noProjects')"
      data-testid="central-project-select"
      @update:model-value="onChange"
    />
    <small
      v-if="serverId !== null"
      class="central-connection-state"
      data-testid="central-project-connection"
    >
      {{ connectionLabel(central, serverId, loading) }}
    </small>
  </div>
</template>

<style scoped>
.central-project-picker {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.central-connection-state {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}
</style>
