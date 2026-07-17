<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

import AttachmentPreview from '@/components/datasets/AttachmentPreview.vue'
import { useAttachmentUpload } from '@/composables/useAttachmentUpload'
import { datasetFormatOf } from '@/core/datasets/parse'
import { collectAttachmentReferences, firstFreeAttachmentName, renameAttachmentRefs } from '@/core/model/rename-attachment'
import type { AttachmentRef } from '@/core/model/types'
import { useAppI18n } from '@/i18n'
import * as attachmentsRepo from '@/persistence/attachments-repo'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

import AttachmentConflictDialog, { type ConflictAction } from './AttachmentConflictDialog.vue'
import RenameAttachmentDialog from './RenameAttachmentDialog.vue'

const { t } = useAppI18n()
const form = useFormStore()
const editor = useEditorStore()
const { attachFile } = useAttachmentUpload()

const visible = computed({
  get: () => editor.activeDialog === 'attachments',
  set: (open: boolean) => { editor.activeDialog = open ? 'attachments' : null },
})

// Reclaim blobs unreferenced by the current doc or any undo/redo history
// entry every time the dialog opens (close() runs its own, narrower sweep).
watch(visible, (open) => { if (open) void form.sweepOrphanAttachments() })

// --- drill-in preview: the dialog swaps between list and preview views -----
// One surface, no modal-over-modal: the eye button morphs this dialog into
// the preview (back arrow in the header, width eases 38→52rem) and back/Esc
// returns to the list. The standalone DatasetPreviewDialog stays for the
// properties panel's "View file", where no dialog is open underneath.

const previewFilename = ref<string | null>(null)
const backButton = ref<{ $el?: HTMLElement } | null>(null)

const openPreview = async (filename: string): Promise<void> => {
  previewFilename.value = filename
  // The eye button unmounts with the list; park focus on Back so keyboard
  // users aren't dropped to <body>.
  await nextTick()
  backButton.value?.$el?.focus()
}

const closePreview = (): void => { previewFilename.value = null }

// While previewing, Escape backs out one level instead of closing the dialog:
// PrimeVue's own document listener no-ops (close-on-escape is bound false) and
// this one takes over. Bound only for the preview view.
const onPreviewKeydown = (event: KeyboardEvent): void => {
  if (event.code === 'Escape') closePreview()
}
watch(previewFilename, (now, before) => {
  if (now !== null && before === null) document.addEventListener('keydown', onPreviewKeydown)
  else if (now === null) document.removeEventListener('keydown', onPreviewKeydown)
})
onUnmounted(() => { document.removeEventListener('keydown', onPreviewKeydown) })

// Reopening always starts at the list.
watch(visible, (open) => { if (!open) closePreview() })

const fileInput = ref<HTMLInputElement | null>(null)
const replaceInput = ref<HTMLInputElement | null>(null)

// --- row model: form.doc.attachments + missing-required rows --------------
// The list always reflects exactly what the form uses — never raw
// attachmentsRepo storage records — so a replaced filename renders as one
// row, never a stray duplicate for a since-superseded record.

const refCounts = computed<Map<string, number>>(() =>
  form.doc !== null ? collectAttachmentReferences(form.doc) : new Map())

interface AttachmentRow {
  ref: AttachmentRef | null
  filename: string
  missing: boolean
}

const rows = computed<AttachmentRow[]>(() => {
  const refs = form.doc?.attachments ?? []
  const present = new Set(refs.map((a) => a.filename))
  const missing = [...refCounts.value.keys()]
    .filter((name) => !present.has(name))
    .sort()
    .map((filename) => ({ ref: null, filename, missing: true }))
  return [...refs.map((ref) => ({ ref, filename: ref.filename, missing: false })), ...missing]
})

const refCountOf = (filename: string): number => refCounts.value.get(filename) ?? 0

const formatSize = (bytes: number): string =>
  bytes < 1024
    ? t('dialogs.attachments.sizeBytes', { size: bytes })
    : bytes < 1024 * 1024
      ? t('dialogs.attachments.sizeKilobytes', { size: (bytes / 1024).toFixed(1) })
      : t('dialogs.attachments.sizeMegabytes', { size: (bytes / 1024 / 1024).toFixed(1) })

const remove = async (attachmentRef: AttachmentRef): Promise<void> => {
  await attachmentsRepo.deleteAttachment(attachmentRef.id)
  form.mutate(t('dialogs.attachments.undoRemove'), (d) => {
    // Plain-copy the survivors: never leave elements reached through the
    // reactive `d` in the assigned array (attachFile's mutate-shape rule).
    d.attachments = d.attachments.filter((a) => a.id !== attachmentRef.id).map((a) => ({ ...a }))
  })
}

// --- rename -----------------------------------------------------------------

const renameTarget = ref<AttachmentRef | null>(null)
const existingFilenames = computed<string[]>(() => (form.doc?.attachments ?? []).map((a) => a.filename))

const confirmRename = async (newName: string): Promise<void> => {
  const target = renameTarget.value
  renameTarget.value = null
  if (target === null) return
  // Repo call first, doc mutate second — same ordering convention as attachFile.
  await attachmentsRepo.renameAttachment(target.id, newName)
  form.mutate(t('dialogs.attachments.undoRename'), (d) => {
    renameAttachmentRefs(d, target.filename, newName)
  })
}

// --- per-row replace (and a Missing row's Upload — same mechanism) ---------

const replaceTarget = ref<string | null>(null)
const storedAsNotice = ref<{ filename: string, original: string } | null>(null)

const startReplace = (filename: string): void => {
  replaceTarget.value = filename
  replaceInput.value?.click()
}

const onReplaceFile = async (event: Event): Promise<void> => {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  const target = replaceTarget.value
  replaceTarget.value = null
  if (file === undefined || target === null) return
  storedAsNotice.value = file.name !== target ? { filename: target, original: file.name } : null
  // A Missing row's Upload is an add, not a replace (nothing existed under
  // that name yet), so it keeps attachFile's default add label.
  const existed = (form.doc?.attachments ?? []).some((a) => a.filename === target)
  await attachFile(file, target, existed ? { undoLabel: t('dialogs.attachments.undoReplace') } : undefined)
}

// --- upload + conflict handling (Replace / Keep both / Skip / apply-to-all) -

const conflictQueue = ref<File[]>([])
const conflictIndex = ref(0)
const applyAllChoice = ref<ConflictAction | null>(null)
const activeConflict = computed<File | null>(() => conflictQueue.value[conflictIndex.value] ?? null)
const conflictRemaining = computed<number>(() => Math.max(0, conflictQueue.value.length - conflictIndex.value - 1))

const applyConflict = async (action: ConflictAction, file: File): Promise<void> => {
  if (action === 'skip') return
  if (action === 'replace') {
    await attachFile(file, undefined, { undoLabel: t('dialogs.attachments.undoReplace') })
    return
  }
  const known = new Set((form.doc?.attachments ?? []).map((a) => a.filename))
  await attachFile(file, firstFreeAttachmentName(known, file.name))
}

const advanceConflict = async (): Promise<void> => {
  while (conflictIndex.value < conflictQueue.value.length) {
    if (applyAllChoice.value === null) return // wait for the modal to resolve this one
    await applyConflict(applyAllChoice.value, conflictQueue.value[conflictIndex.value])
    conflictIndex.value++
  }
  conflictQueue.value = []
}

const resolveConflict = async (payload: { action: ConflictAction, applyToRemaining: boolean }): Promise<void> => {
  if (payload.applyToRemaining) applyAllChoice.value = payload.action
  const file = activeConflict.value
  if (file !== null) await applyConflict(payload.action, file)
  conflictIndex.value++
  await advanceConflict()
}

const upload = async (event: Event): Promise<void> => {
  const files = (event.target as HTMLInputElement).files
  if (files === null || form.recordId === null) return
  const known = new Set((form.doc?.attachments ?? []).map((a) => a.filename))
  const queue: File[] = []
  for (const file of files) {
    if (known.has(file.name)) { queue.push(file); continue }
    await attachFile(file)
    known.add(file.name)
  }
  ;(event.target as HTMLInputElement).value = ''
  if (queue.length > 0) {
    conflictQueue.value = queue
    conflictIndex.value = 0
    applyAllChoice.value = null
    await advanceConflict()
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :close-on-escape="previewFilename === null"
    :style="{ width: previewFilename === null ? '38rem' : '52rem', maxWidth: '95vw' }"
    class="attachments-dialog-panel"
    data-testid="attachments-dialog"
  >
    <template #header>
      <div v-if="previewFilename !== null" class="attachments-header-drill">
        <Button
          ref="backButton"
          icon="pi pi-arrow-left"
          severity="secondary"
          text
          rounded
          :aria-label="t('dialogs.attachments.backToList')"
          data-testid="attachment-preview-back"
          @click="closePreview"
        />
        <span class="p-dialog-title">{{ previewFilename }}</span>
      </div>
      <span v-else class="p-dialog-title">{{ t('dialogs.attachments.header') }}</span>
    </template>

    <Transition :name="previewFilename !== null ? 'drill-forward' : 'drill-back'" mode="out-in">
      <div v-if="previewFilename !== null" :key="`preview-${previewFilename}`">
        <AttachmentPreview :filename="previewFilename" />
      </div>
      <div v-else key="list">
        <p class="attachments-hint">
          {{ t('dialogs.attachments.hint') }}
        </p>

        <div v-if="rows.length === 0" class="attachments-empty">
          <i class="pi pi-paperclip" />
          <p>{{ t('dialogs.attachments.empty') }}</p>
        </div>

        <ul v-else class="attachments-list">
          <li v-for="row in rows" :key="row.filename" class="attachment-row">
            <div class="attachment-row-main">
              <i class="pi pi-file" />
              <span class="attachment-name">{{ row.filename }}</span>
              <span
                v-if="row.missing"
                class="attachment-status-missing"
                data-testid="attachment-missing"
              >
                {{ t('dialogs.attachments.missing') }}
              </span>
              <span v-else class="attachment-meta">{{ row.ref!.mediatype }} · {{ formatSize(row.ref!.size) }}</span>

              <div class="attachment-row-actions">
                <Button
                  v-if="row.missing"
                  :label="t('dialogs.attachments.uploadMissing')"
                  icon="pi pi-upload"
                  severity="secondary"
                  text
                  size="small"
                  :aria-label="t('dialogs.attachments.uploadMissingAria', { filename: row.filename })"
                  data-testid="attachment-upload-missing"
                  @click="startReplace(row.filename)"
                />
                <template v-else>
                  <Button
                    v-if="datasetFormatOf(row.filename) !== undefined || row.ref!.mediatype.startsWith('image/')"
                    icon="pi pi-eye"
                    severity="secondary"
                    text
                    rounded
                    size="small"
                    :aria-label="t('dialogs.attachments.viewFile', { filename: row.filename })"
                    data-testid="attachment-view"
                    @click="openPreview(row.filename)"
                  />
                  <Button
                    icon="pi pi-pencil"
                    severity="secondary"
                    text
                    rounded
                    size="small"
                    :aria-label="t('dialogs.attachments.renameAria', { filename: row.filename })"
                    data-testid="attachment-rename"
                    @click="renameTarget = row.ref"
                  />
                  <Button
                    icon="pi pi-upload"
                    severity="secondary"
                    text
                    rounded
                    size="small"
                    :aria-label="t('dialogs.attachments.replaceAria', { filename: row.filename })"
                    data-testid="attachment-replace"
                    @click="startReplace(row.filename)"
                  />
                  <Button
                    icon="pi pi-trash"
                    severity="secondary"
                    text
                    rounded
                    size="small"
                    :aria-label="t('dialogs.attachments.deleteFile', { filename: row.filename })"
                    @click="remove(row.ref!)"
                  />
                </template>
              </div>
            </div>

            <p class="attachment-row-sub">
              <span data-testid="attachment-ref-count">
                {{ t('dialogs.attachments.usedByCount', { count: refCountOf(row.filename) }, refCountOf(row.filename)) }}
              </span>
              <span v-if="row.missing" class="attachment-missing-hint">{{ t('dialogs.attachments.missingHint') }}</span>
            </p>

            <p
              v-if="storedAsNotice?.filename === row.filename"
              class="attachment-stored-as"
              data-testid="attachment-stored-as"
            >
              {{ t('dialogs.attachments.storedAs', { stored: storedAsNotice.filename, original: storedAsNotice.original }) }}
            </p>
          </li>
        </ul>
      </div>
    </Transition>

    <template v-if="previewFilename === null" #footer>
      <input
        ref="fileInput"
        type="file"
        multiple
        class="attachments-input"
        data-testid="attachment-file-input"
        @change="upload"
      >
      <input
        ref="replaceInput"
        type="file"
        class="attachments-input"
        data-testid="attachment-replace-input"
        @change="onReplaceFile"
      >
      <Button
        :label="t('dialogs.attachments.upload')"
        icon="pi pi-upload"
        data-testid="attachment-upload"
        @click="fileInput?.click()"
      />
    </template>
  </Dialog>

  <RenameAttachmentDialog
    :attachment="renameTarget"
    :existing-filenames="existingFilenames"
    :reference-count="renameTarget === null ? 0 : refCountOf(renameTarget.filename)"
    @update:attachment="renameTarget = $event"
    @rename="confirmRename"
  />

  <AttachmentConflictDialog
    :file="activeConflict"
    :remaining="conflictRemaining"
    @resolve="resolveConflict"
  />
</template>

<style scoped>
/* The dialog is one surface for both views: width eases between the list's
   38rem and the preview's 52rem instead of jumping. */
.attachments-dialog-panel {
  transition: width 0.25s ease;
}

.attachments-header-drill {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  min-width: 0;
}

.attachments-header-drill .p-dialog-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* Drill-in: the entering view slides from the direction you're heading —
   preview from the right going deeper, list from the left coming back. */
.drill-forward-enter-active,
.drill-forward-leave-active,
.drill-back-enter-active,
.drill-back-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.drill-forward-enter-from { opacity: 0; transform: translateX(12px); }
.drill-forward-leave-to { opacity: 0; transform: translateX(-12px); }
.drill-back-enter-from { opacity: 0; transform: translateX(-12px); }
.drill-back-leave-to { opacity: 0; transform: translateX(12px); }

@media (prefers-reduced-motion: reduce) {
  .attachments-dialog-panel { transition: none; }

  .drill-forward-enter-active,
  .drill-forward-leave-active,
  .drill-back-enter-active,
  .drill-back-leave-active {
    transition: opacity 0.15s ease;
  }

  .drill-forward-enter-from,
  .drill-forward-leave-to,
  .drill-back-enter-from,
  .drill-back-leave-to {
    transform: none;
  }
}

.attachments-hint {
  margin: 0 0 var(--odk-spacing-l);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.attachments-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--odk-spacing-s);
  padding: var(--odk-spacing-xl);
  color: var(--odk-muted-text-color);
}

.attachments-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.attachment-row {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
  padding: var(--odk-spacing-s) var(--odk-spacing-m);
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
}

.attachment-row-main {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-m);
}

.attachment-name {
  font-weight: 500;
}

.attachment-meta {
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.attachment-status-missing {
  color: var(--odk-warning-text-color);
  font-size: var(--odk-hint-font-size);
  font-weight: 500;
}

.attachment-row-actions {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
  margin-inline-start: auto;
}

.attachment-row-sub {
  margin: 0;
  display: flex;
  gap: var(--odk-spacing-m);
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.attachment-missing-hint {
  color: var(--odk-muted-text-color);
}

.attachment-stored-as {
  margin: 0;
  color: var(--odk-muted-text-color);
  font-size: var(--odk-hint-font-size);
}

.attachments-input {
  display: none;
}
</style>
