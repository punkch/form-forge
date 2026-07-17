<script setup lang="ts">
// Read-only body of an attachment preview, driven by a filename prop.
// CSV/GeoJSON render as a virtual-scrolled table of the first 500 rows; XML
// (and anything unrecognized) as raw text; image attachments as an <img> fed
// by a managed object URL (revoked on filename switch and unmount). Shared by
// DatasetPreviewDialog (standalone modal) and AttachmentsDialog (drill-in view).
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import { onUnmounted, ref, watch, computed } from 'vue'

import { datasetFormatOf, parseDataset, type ParsedDataset } from '@/core/datasets/parse'
import { useAppI18n } from '@/i18n'
import * as attachmentsRepo from '@/persistence/attachments-repo'
import { useFormStore } from '@/stores/form'

const props = defineProps<{ filename: string }>()

const { t } = useAppI18n()
const form = useFormStore()

const state = ref<'loading' | 'ready' | 'missing'>('loading')
const parsed = ref<ParsedDataset | null>(null)
const imageUrl = ref<string | null>(null)

const revokeImage = (): void => {
  if (imageUrl.value !== null) {
    URL.revokeObjectURL(imageUrl.value)
    imageUrl.value = null
  }
}

const load = async (): Promise<void> => {
  state.value = 'loading'
  parsed.value = null
  revokeImage()
  const name = props.filename
  const attachment = form.doc?.attachments.find((a) => a.filename === name)
  const record = attachment === undefined ? undefined : await attachmentsRepo.getAttachment(attachment.id)
  if (attachment === undefined || record === undefined) {
    state.value = 'missing'
    return
  }
  if (props.filename !== name) return // switched while reading
  // Dataset extensions win over image mediatype (mirrors roleFor's precedence).
  if (datasetFormatOf(name) === undefined && attachment.mediatype.startsWith('image/')) {
    imageUrl.value = URL.createObjectURL(record.blob)
    state.value = 'ready'
    return
  }
  const text = await record.blob.text()
  if (props.filename !== name) return // switched while reading
  parsed.value = parseDataset(name, text)
  state.value = 'ready'
}

watch(() => props.filename, () => { void load() }, { immediate: true })
onUnmounted(revokeImage)

/** DataTable wants row objects; key cells by column index to survive dupes. */
const tableRows = computed(() => {
  const p = parsed.value
  if (p === null) return []
  return p.rows.map((row) =>
    Object.fromEntries(p.columns.map((_column, i) => [String(i), row[i] ?? ''])))
})

const isEmpty = computed(() =>
  parsed.value !== null && parsed.value.rawText === undefined &&
  parsed.value.columns.length === 0 && parsed.value.rows.length === 0 &&
  !parsed.value.issues.some((issue) => issue.severity === 'error'))
</script>

<template>
  <p v-if="state === 'loading'" class="dataset-note">
    {{ t('dialogs.datasetPreview.loading') }}
  </p>
  <p v-else-if="state === 'missing'" class="dataset-note" data-testid="dataset-preview-missing">
    {{ t('dialogs.datasetPreview.missing') }}
  </p>
  <img
    v-else-if="imageUrl !== null"
    :src="imageUrl"
    :alt="filename"
    class="dataset-image"
    data-testid="dataset-preview-image"
  >
  <template v-else-if="parsed">
    <p
      v-for="(issue, i) in parsed.issues"
      :key="i"
      class="dataset-issue"
      :class="`dataset-issue-${issue.severity}`"
      data-testid="dataset-preview-issue"
    >
      <i :class="issue.severity === 'error' ? 'pi pi-times-circle' : 'pi pi-exclamation-triangle'" />
      {{ issue.message }}
    </p>

    <p v-if="parsed.truncated" class="dataset-truncated" data-testid="dataset-preview-truncated">
      <i class="pi pi-info-circle" />
      {{ t('dialogs.datasetPreview.truncated', { count: parsed.rows.length }) }}
    </p>

    <pre
      v-if="parsed.rawText !== undefined"
      class="dataset-raw"
      data-testid="dataset-preview-raw"
    >{{ parsed.rawText }}</pre>

    <p v-else-if="isEmpty" class="dataset-note">
      {{ t('dialogs.datasetPreview.empty') }}
    </p>

    <DataTable
      v-else-if="parsed.columns.length > 0"
      :value="tableRows"
      scrollable
      scroll-height="60vh"
      :virtual-scroller-options="{ itemSize: 36 }"
      size="small"
      striped-rows
      data-testid="dataset-preview-table"
    >
      <Column
        v-for="(column, i) in parsed.columns"
        :key="i"
        :field="String(i)"
        :header="column"
      />
    </DataTable>
  </template>
</template>

<style scoped>
.dataset-note {
  margin: 0;
  color: var(--odk-muted-text-color);
}

.dataset-issue {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  margin: 0 0 var(--odk-spacing-m);
  font-size: var(--odk-hint-font-size);
}

.dataset-issue-error {
  color: var(--odk-error-text-color);
}

.dataset-issue-warning {
  color: var(--odk-warning-text-color);
}

.dataset-truncated {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  margin: 0 0 var(--odk-spacing-m);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.dataset-image {
  display: block;
  max-width: 100%;
  max-height: 60vh;
  margin-inline: auto;
  object-fit: contain;
}

.dataset-raw {
  margin: 0;
  max-height: 60vh;
  overflow: auto;
  padding: var(--odk-spacing-m);
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
  background: var(--odk-light-background-color);
  font-size: var(--odk-hint-font-size);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
