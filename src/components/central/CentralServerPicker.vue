<script setup lang="ts">
/**
 * Server dropdown: options come straight from the reactive Central server list
 * (`central.servers`). Emits the chosen server id (or `null` when cleared) so a
 * parent can drive `CentralProjectPicker`.
 */
import Select from 'primevue/select'

import { useAppI18n } from '@/i18n'
import { useCentralStore } from '@/stores/central'

defineProps<{ modelValue: string | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const central = useCentralStore()
const { t } = useAppI18n()

const onChange = (value: string | null): void => { emit('update:modelValue', value) }
</script>

<template>
  <Select
    :model-value="modelValue"
    :options="central.servers"
    option-label="name"
    option-value="id"
    :placeholder="t('central.servers.selectPlaceholder')"
    :empty-message="t('central.servers.empty')"
    data-testid="central-server-select"
    @update:model-value="onChange"
  >
    <template #option="{ option }">
      <span :data-testid="`central-server-option-${option.id}`">{{ option.name }}</span>
    </template>
  </Select>
</template>
