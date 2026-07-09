<script setup lang="ts">
import SplitButton from 'primevue/splitbutton'
import { useToast } from 'primevue/usetoast'
import { computed, toRaw } from 'vue'

import { downloadBlob } from '@/composables/useDownload'
import { exportZip } from '@/core/export/zip'
import type { FormDocument } from '@/core/model/types'
import { serializeXForm } from '@/core/xform/serializer'
import { writeXlsForm } from '@/core/xlsform/writer'
import { listAttachments } from '@/persistence/attachments-repo'
import { useFormStore } from '@/stores/form'

withDefaults(defineProps<{
  /** Icon-only rendering for narrow headers. */
  compact?: boolean
}>(), { compact: false })

const form = useFormStore()
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
      summary: 'Fix errors before exporting',
      detail: 'The form has validation errors — see the Problems panel.',
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
    toast.add({ severity: 'warn', summary: 'Export warning', detail: issue.message, life: 5000 })
  }
  downloadBlob(data, `${baseName.value}.zip`, 'application/zip')
}

const items = [
  { label: 'XLSForm (.xlsx)', icon: 'pi pi-file-excel', command: () => { void exportXlsx() } },
  { label: 'ZIP with attachments', icon: 'pi pi-box', command: () => { void exportZipBundle() } },
]
</script>

<template>
  <SplitButton
    :label="compact ? undefined : 'Export'"
    icon="pi pi-download"
    severity="secondary"
    :model="items"
    :aria-label="compact ? 'Export' : undefined"
    data-testid="export-button"
    @click="exportXml"
  />
</template>
