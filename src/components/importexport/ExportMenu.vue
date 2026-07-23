<script setup lang="ts">
import SplitButton from 'primevue/splitbutton'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, ref, toRaw, watch } from 'vue'

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
import { useUiStore, type ExportFormatId } from '@/stores/ui'

const { t } = useAppI18n()
const form = useFormStore()
// Embed hosts can hide individual export actions (or all of them) via the
// init/set-config `exports` config; outside embed mode everything shows.
const embed = useEmbedStore()
const ui = useUiStore()
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

const exportZipBundle = async (variant: 'xform' | 'xlsform'): Promise<void> => {
  if (form.doc === null || form.recordId === null || blockOnErrors()) return
  const attachments = await listAttachments(form.recordId)
  const blobs = new Map(attachments.map((a) => [a.id, a.blob]))
  const { data, issues } = await exportZip(rawDoc(), blobs, variant)
  for (const issue of issues.filter((i) => i.severity === 'warning')) {
    toast.add({ severity: 'warn', summary: t('importExport.export.warningSummary'), detail: issue.message, life: 5000 })
  }
  downloadBlob(data, `${baseName.value}-${variant}.zip`, 'application/zip')
}

interface ExportAction {
  id: ExportFormatId
  /** Compact label shown on the SplitButton primary (states the format). */
  primaryLabel: string
  /** Full label shown in the dropdown. */
  label: string
  icon: string
  run: () => void
}

/** Every enabled export action, in display order. Order is fixed
 * (xform, xlsform, zip-xform, zip-xlsform) — `enabledActions[0]` is still the
 * fallback primary (XForm XML) unless the host hid it. */
const enabledActions = computed<ExportAction[]>(() => {
  const actions: ExportAction[] = []
  if (embed.exportEnabled('xform')) {
    actions.push({
      id: 'xform',
      primaryLabel: t('importExport.export.primaryXform'),
      label: t('importExport.export.xformItem'),
      icon: 'pi pi-download',
      run: exportXml,
    })
  }
  if (embed.exportEnabled('xlsform')) {
    actions.push({
      id: 'xlsform',
      primaryLabel: t('importExport.export.primaryXlsform'),
      label: t('importExport.export.xlsformItem'),
      icon: 'pi pi-file-excel',
      run: () => { void exportXlsx() },
    })
  }
  if (embed.exportEnabled('zip')) {
    actions.push({
      id: 'zip-xform',
      primaryLabel: t('importExport.export.primaryZipXform'),
      label: t('importExport.export.zipXformItem'),
      icon: 'pi pi-box',
      run: () => { void exportZipBundle('xform') },
    })
    actions.push({
      id: 'zip-xlsform',
      primaryLabel: t('importExport.export.primaryZipXlsform'),
      label: t('importExport.export.zipXlsformItem'),
      icon: 'pi pi-box',
      run: () => { void exportZipBundle('xlsform') },
    })
  }
  return actions
})

/** Resolved primary action: the remembered format for this form if it's
 * still enabled, else the first enabled action. Null renders no button at
 * all (host disabled every export). */
const primary = computed<ExportAction | null>(() => {
  const actions = enabledActions.value
  if (actions.length === 0) return null
  const remembered = form.recordId !== null ? ui.getLastExportFormat(form.recordId) : null
  return actions.find((a) => a.id === remembered) ?? actions[0]
})

/** Runs the chosen format and, for dropdown picks, remembers it as the
 * form's primary going forward. The primary click itself skips the write —
 * it's already the remembered format. */
const pick = (action: ExportAction): void => {
  if (form.recordId !== null) ui.setLastExportFormat(form.recordId, action.id)
  action.run()
}

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
  ...enabledActions.value.map((action) => {
    const isPrimary = action.id === primary.value?.id
    return {
      label: action.label,
      icon: isPrimary ? 'pi pi-check' : action.icon,
      class: isPrimary ? 'export-format-active' : undefined,
      command: () => { pick(action) },
    }
  }),
])

/** Retrigger a short label crossfade when the primary format changes within
 * the SAME form (a dropdown pick) — purely cosmetic. Gated on `form.recordId`
 * so plain form navigation, where a different remembered format is expected
 * context, doesn't flash. */
const labelAnimating = ref(false)
watch(() => [form.recordId, primary.value?.id] as const, async ([rec, id], [prevRec, prevId]) => {
  if (rec !== prevRec || prevId === undefined || id === undefined || id === prevId) return
  labelAnimating.value = false
  await nextTick()
  labelAnimating.value = true
})
</script>

<template>
  <!--
    TieredMenu (the SplitButton's internal menu) hardcodes aria-level on
    every role="menuitem" li — invalid per axe's aria-allowed-attr
    (aria-level isn't allowed on menuitem). SplitButton forwards its `pt`
    prop to the menu via ptm('pcMenu'), and TieredMenuSub merges that
    section's props AFTER the hardcoded aria-level, so nulling it here wins
    (Vue drops null-valued attrs). This is the repo's first `pt` usage —
    kept narrow and typed-prop-first everywhere else. Regression:
    tests/component/export-menu.spec.ts "does not emit aria-level".
  -->
  <SplitButton
    v-if="primary !== null"
    :label="primary.primaryLabel"
    :icon="primary.icon"
    severity="secondary"
    :model="items"
    :class="{ 'ff-export-label-changed': labelAnimating }"
    :menu-button-props="{ 'aria-label': t('importExport.export.moreOptions') }"
    :pt="{ pcMenu: { item: { 'aria-level': null } } }"
    data-testid="export-button"
    @click="primary.run"
    @animationend="labelAnimating = false"
  />
</template>

<style scoped>
.ff-export-label-changed :deep(.p-button-label) {
  animation: ff-export-label-fade var(--builder-motion-duration-s) var(--builder-motion-ease-standard);
}

@keyframes ff-export-label-fade {
  from { opacity: 0.35; }
  to { opacity: 1; }
}
</style>
