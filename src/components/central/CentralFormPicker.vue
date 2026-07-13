<script setup lang="ts">
/**
 * Form dropdown for a chosen server + project. Fetches the form list from
 * Central (`central.listForms`) when either changes. With `publishedOnly` the
 * list drops never-published drafts (`publishedAt === null`) — the import
 * picker only offers published forms. Resets across changes and re-throws
 * transport failures to the parent via `error`.
 */
import Select from 'primevue/select'
import { computed } from 'vue'

import { useCentralList } from '@/composables/useCentralList'
import type { CentralFormSummary } from '@/core/central/types'
import { useAppI18n } from '@/i18n'
import { useCentralStore } from '@/stores/central'

const props = withDefaults(
  defineProps<{
    serverId: string | null
    projectId: number | null
    modelValue: string | null
    publishedOnly?: boolean
  }>(),
  { publishedOnly: false }
)
const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  error: [error: unknown]
}>()

const central = useCentralStore()
const { t } = useAppI18n()

// With `publishedOnly` the picker drops never-published drafts, so form
// visibility (and thus selection validity) is decided by this predicate.
const isOffered = (form: CentralFormSummary): boolean => !props.publishedOnly || form.publishedAt !== null

// Reset + refetch whenever the server or project changes. A still-valid
// selection survives the refetch; one no longer offered (filtered out or
// absent) is cleared.
const { items: forms, loading } = useCentralList<CentralFormSummary, readonly [string | null, number | null]>({
  deps: () => [props.serverId, props.projectId] as const,
  ready: ([serverId, projectId]) => serverId !== null && projectId !== null,
  fetch: ([serverId, projectId]) => central.listForms(serverId!, projectId!),
  selectionValid: (fetched) =>
    props.modelValue === null || fetched.some((form) => isOffered(form) && form.xmlFormId === props.modelValue),
  clearSelection: () => { if (props.modelValue !== null) emit('update:modelValue', null) },
  onError: (error) => emit('error', error),
})

const options = computed(() =>
  forms.value.filter(isOffered).map((form) => ({ value: form.xmlFormId, label: form.name ?? form.xmlFormId })))

const onChange = (value: string | null): void => { emit('update:modelValue', value) }
</script>

<template>
  <Select
    :model-value="modelValue"
    :options="options"
    option-label="label"
    option-value="value"
    :loading="loading"
    :disabled="serverId === null || projectId === null"
    :placeholder="t('central.import.formPlaceholder')"
    :empty-message="t('central.import.noForms')"
    data-testid="central-form-select"
    @update:model-value="onChange"
  />
</template>
