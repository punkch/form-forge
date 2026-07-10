<script setup lang="ts">
import SplitButton from 'primevue/splitbutton'
import { useToast } from 'primevue/usetoast'
import { computed, toRaw } from 'vue'

import { downloadBlob } from '@/composables/useDownload'
import { exportZip } from '@/core/export/zip'
import { untranslatedCellCount } from '@/core/model/translations'
import type { FormDocument } from '@/core/model/types'
import { serializeXForm } from '@/core/xform/serializer'
import { writeXlsForm } from '@/core/xlsform/writer'
import { useAppI18n } from '@/i18n'
import { listAttachments } from '@/persistence/attachments-repo'
import { useEmbedStore } from '@/stores/embed'
import { useFormStore } from '@/stores/form'

const { t } = useAppI18n()
const form = useFormStore()
// Embed hosts can hide individual export actions (or all of them) via the
// init/set-config `exports` config; outside embed mode everything shows.
const embed = useEmbedStore()
const toast = useToast()

const baseName = computed(() => {
  const settings = form.doc?.settings
  return `${settings?.formId ?? 'form'}-${settings?.version ?? ''}`.replace(/-$/, '')
})

const rawDoc = (): FormDocument => toRaw(form.doc) as FormDocument

const blockOnErrors = (): boolean => {
  if (form.errorCount > 0) {
    toast.add({
      severity: 'warn',
      summary: t('importExport.export.blockedSummary'),
      detail: t('importExport.export.blockedDetail'),
      life: 4000,
    })
    return true
  }
  return false
}

const exportXml = (): void => {
  if (form.doc === null || blockOnErrors()) return
  const { xml } = serializeXForm(rawDoc())
  downloadBlob(xml, `${baseName.value}.xml`, 'text/xml')
}

const exportXlsx = async (): Promise<void> => {
  if (form.doc === null || blockOnErrors()) return
  const data = await writeXlsForm(rawDoc())
  downloadBlob(data, `${baseName.value}.xlsx`,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

const exportZipBundle = async (): Promise<void> => {
  if (form.doc === null || form.recordId === null || blockOnErrors()) return
  const attachments = await listAttachments(form.recordId)
  const blobs = new Map(attachments.map((a) => [a.id, a.blob]))
  const { data, issues } = await exportZip(rawDoc(), blobs)
  for (const issue of issues.filter((i) => i.severity === 'warning')) {
    toast.add({ severity: 'warn', summary: t('importExport.export.warningSummary'), detail: issue.message, life: 5000 })
  }
  downloadBlob(data, `${baseName.value}.zip`, 'application/zip')
}

interface ExportAction {
  label: string
  icon: string
  run: () => void
}

const secondaryActions = computed<ExportAction[]>(() => {
  const actions: ExportAction[] = []
  if (embed.exportEnabled('xlsform')) {
    actions.push({ label: t('importExport.export.xlsformItem'), icon: 'pi pi-file-excel', run: () => { void exportXlsx() } })
  }
  if (embed.exportEnabled('zip')) {
    actions.push({ label: t('importExport.export.zipItem'), icon: 'pi pi-box', run: () => { void exportZipBundle() } })
  }
  return actions
})

/** Primary click: XForm XML as always — unless the host hid it, in which case
 * the first remaining action is promoted. Null renders no button at all. */
const primary = computed<ExportAction | null>(() =>
  embed.exportEnabled('xform')
    ? { label: t('importExport.export.label'), icon: 'pi pi-download', run: exportXml }
    : secondaryActions.value[0] ?? null)

/** Missing translation cells across all declared languages (0 when the form
 * declares none — the summary omits the segment entirely then). The core
 * helper walks the document; see untranslatedCellCount for what counts. */
const untranslatedCount = (): number => {
  const doc = form.doc as FormDocument | null
  return doc === null ? 0 : untranslatedCellCount(doc)
}

/** Plain function used as the menu item's label so the full-document
 * translation walk runs only while the dropdown is open, not on every edit. */
const readinessSummary = (): string => {
  if (form.errorCount > 0) {
    return t('importExport.export.summaryBlocked', { count: form.errorCount }, form.errorCount)
  }
  const ready = t('importExport.export.summaryReady', { count: form.warningCount }, form.warningCount)
  const untranslated = untranslatedCount()
  return untranslated > 0
    ? ready + t('importExport.export.summarySeparator') +
      t('importExport.export.summaryUntranslated', { count: untranslated }, untranslated)
    : ready
}

const items = computed(() => [
  { label: readinessSummary, disabled: true },
  { separator: true },
  ...(embed.exportEnabled('xform') ? secondaryActions.value : secondaryActions.value.slice(1))
    .map((action) => ({ label: action.label, icon: action.icon, command: () => { action.run() } })),
])
</script>

<template>
  <SplitButton
    v-if="primary !== null"
    :label="primary.label"
    :icon="primary.icon"
    severity="secondary"
    :model="items"
    :menu-button-props="{ 'aria-label': t('importExport.export.moreOptions') }"
    data-testid="export-button"
    @click="primary.run"
  />
</template>
