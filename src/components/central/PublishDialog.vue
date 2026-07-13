<script setup lang="ts">
/**
 * Publish the open form's current draft to an ODK Central project.
 *
 * Reads the open form exactly like ExportMenu (serialize the raw doc, list its
 * attachments) and hands the payload to `central.publishForm(...)`, which runs
 * the single network attempt behind the store's private-closure token boundary
 * — the dialog never sees a session token or the transport client. Remembered
 * publish targets pre-fill the pickers (most recent first) and offer one-click
 * re-deploy; the full server/project pickers stay available to switch
 * destination or create a new form.
 *
 * A `409` conflict surfaces recovery offers: a formId collision (create mode)
 * can either update the existing form instead or bump the version and retry; a
 * version already used on the server (update mode) offers only the version bump.
 * A formId rename since the last publish warns that publishing creates a NEW
 * form on that server. On success the destination is remembered as a target.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Message from 'primevue/message'
import RadioButton from 'primevue/radiobutton'
import { computed, nextTick, ref, toRaw, watch } from 'vue'

import CentralFormPicker from '@/components/central/CentralFormPicker.vue'
import CentralProjectPicker from '@/components/central/CentralProjectPicker.vue'
import CentralServerPicker from '@/components/central/CentralServerPicker.vue'
import GuideTrigger from '@/components/help/GuideTrigger.vue'
import type { CentralPublishResult, PublishMode, PublishProgress } from '@/core/central/publish'
import { CentralError } from '@/core/central/types'
import type { FormDocument } from '@/core/model/types'
import { bumpVersion } from '@/core/model/version'
import type { ArchiveAttachment } from '@/core/workspace/archive'
import { serializeXForm } from '@/core/xform/serializer'
import { useAppI18n } from '@/i18n'
import { centralErrorKey } from '@/i18n/central-errors'
import { listAttachments } from '@/persistence/attachments-repo'
import type { PublishTargetRecord } from '@/persistence/db'
import { useCentralStore } from '@/stores/central'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

const { t } = useAppI18n()
const form = useFormStore()
const editor = useEditorStore()
const central = useCentralStore()

const visible = computed({
  get: () => editor.activeDialog === 'publish',
  set: (open: boolean) => { editor.activeDialog = open ? 'publish' : null },
})

// --- Selection state --------------------------------------------------------
const targets = ref<PublishTargetRecord[]>([])
const selectedServerId = ref<string | null>(null)
const selectedProjectId = ref<number | null>(null)
/** xmlFormId chosen via the form picker when updating without a remembered target. */
const selectedFormId = ref<string | null>(null)
const mode = ref<PublishMode>('create')
/** Set by the 409-conflict recovery: publish as an update against this existing
 * form id, overriding the create/rename logic (the form already exists on the
 * server, so creating it again can only fail identically). */
const forceUpdateId = ref<string | null>(null)

// --- Publish lifecycle state ------------------------------------------------
const publishing = ref(false)
const progressText = ref('')
const result = ref<CentralPublishResult | null>(null)
const conflict = ref<CentralError | null>(null)
/** The mode of the publish that hit the conflict — a create-mode collision
 * offers "update instead" + bump; an update-mode version clash offers only the
 * bump. Null when no conflict is showing. */
const conflictMode = ref<PublishMode | null>(null)
const errorText = ref('')

const currentFormId = computed(() => form.doc?.settings.formId ?? '')
const currentVersion = computed(() => form.doc?.settings.version ?? '')

const serverName = (id: string): string =>
  central.servers.find((s) => s.id === id)?.name ?? id

const formatDate = (ts: number): string => new Date(ts).toLocaleDateString()

const targetMatchesSelection = (target: PublishTargetRecord): boolean =>
  target.serverId === selectedServerId.value && target.projectId === selectedProjectId.value

/** The remembered target the current server+project selection points at, if any
 * (derived, so switching the pickers away from a target clears it for free). */
const chosenTarget = computed<PublishTargetRecord | null>(() =>
  targets.value.find(targetMatchesSelection) ?? null)

/** A remembered target exists for this destination but the form's id changed
 * since — publishing will create a NEW Central form rather than update it. */
const renameMismatch = computed<boolean>(() =>
  chosenTarget.value !== null && currentFormId.value !== chosenTarget.value.xmlFormId)

/** A rename forces a create under the new formId regardless of the mode toggle;
 * a 409-conflict recovery (forceUpdateId) overrides everything to update. */
const effectiveMode = computed<PublishMode>(() => {
  if (forceUpdateId.value !== null) return 'update'
  return renameMismatch.value ? 'create' : mode.value
})

const effectiveXmlFormId = computed<string>(() => {
  if (forceUpdateId.value !== null) return forceUpdateId.value
  if (effectiveMode.value === 'create') return currentFormId.value
  if (chosenTarget.value !== null) return chosenTarget.value.xmlFormId
  return selectedFormId.value ?? ''
})

/** Show the form picker only when updating an existing form without a remembered
 * target to supply its id. */
const needsFormPicker = computed<boolean>(() =>
  effectiveMode.value === 'update' && chosenTarget.value === null)

const canSubmit = computed<boolean>(() =>
  !publishing.value &&
  form.recordId !== null &&
  selectedServerId.value !== null &&
  selectedProjectId.value !== null &&
  effectiveXmlFormId.value !== '')

// Default the mode toggle to "update" whenever the selection lands on a
// remembered target, else "create" (the user can still switch it).
watch(chosenTarget, (target) => { mode.value = target !== null ? 'update' : 'create' })

// A destination change invalidates any in-flight 409 recovery: a stale
// forceUpdateId (or conflict prompt) would otherwise apply against the previous
// server/project/form id.
watch([selectedServerId, selectedProjectId], () => {
  forceUpdateId.value = null
  conflict.value = null
  conflictMode.value = null
})

/** Load this form's remembered publish targets, most recently published first. */
const loadTargets = async (recordId: string): Promise<void> => {
  targets.value = (await central.listTargetsForForm(recordId))
    .slice()
    .sort((a, b) => b.lastPublishedAt - a.lastPublishedAt)
}

// --- Open: load targets and pre-fill the most recent destination ------------
watch(() => visible.value, async (open) => {
  if (!open) return
  result.value = null
  conflict.value = null
  conflictMode.value = null
  forceUpdateId.value = null
  errorText.value = ''
  const recordId = form.recordId
  if (recordId === null) { targets.value = []; return }
  await loadTargets(recordId)
  const recent = targets.value[0]
  if (recent !== undefined && central.servers.some((s) => s.id === recent.serverId)) {
    selectedServerId.value = recent.serverId
    // The project picker resets its value on a server change; apply the project
    // after that reset has flushed so the pre-filled destination survives.
    await nextTick()
    selectedProjectId.value = recent.projectId
    selectedFormId.value = recent.xmlFormId
  }
})

// --- Publish ----------------------------------------------------------------
// The publish sequence reports a structured phase: the form definition upload,
// then one event per attachment (with its name and 1-based index/total).
const onProgress = (progress: PublishProgress): void => {
  progressText.value = progress.phase === 'form'
    ? t('central.publish.uploadingForm')
    : t('central.publish.uploadingAttachment', {
      name: progress.name ?? '',
      index: progress.index ?? 0,
      total: progress.total ?? 0,
    })
}

const submit = async (): Promise<void> => {
  const doc = form.doc
  const recordId = form.recordId
  const serverId = selectedServerId.value
  const projectId = selectedProjectId.value
  const xmlFormId = effectiveXmlFormId.value
  if (doc === null || recordId === null || serverId === null || projectId === null || xmlFormId === '') return

  publishing.value = true
  progressText.value = ''
  result.value = null
  conflict.value = null
  conflictMode.value = null
  errorText.value = ''
  const attemptMode = effectiveMode.value
  try {
    const { xml } = serializeXForm(toRaw(doc) as FormDocument)
    const records = await listAttachments(recordId)
    const attachments: ArchiveAttachment[] = records.map((a) => ({
      filename: a.filename,
      mediatype: a.mediatype,
      blob: a.blob,
    }))

    const publishResult = await central.publishForm(serverId, projectId, {
      xml,
      attachments,
      xmlFormId,
      mode: attemptMode,
      onProgress,
    })

    await central.upsertTarget({
      formRecordId: recordId,
      serverId,
      projectId,
      xmlFormId,
      lastPublishedVersion: doc.settings.version ?? '',
      lastPublishedAt: Date.now(),
    })
    await loadTargets(recordId)
    result.value = publishResult
  } catch (error) {
    if (error instanceof CentralError && error.kind === 'conflict') {
      conflict.value = error
      conflictMode.value = attemptMode
    } else {
      errorText.value = t(centralErrorKey(error))
    }
  } finally {
    publishing.value = false
    progressText.value = ''
  }
}

/** One-click re-deploy: point the pickers at a remembered target, then publish.
 * Clears any prior 409 recovery explicitly — re-deploying to the already-
 * selected target would not change the pickers, so the destination watcher that
 * normally clears `forceUpdateId` would not fire. */
const redeploy = async (target: PublishTargetRecord): Promise<void> => {
  forceUpdateId.value = null
  conflict.value = null
  conflictMode.value = null
  selectedServerId.value = target.serverId
  await nextTick()
  selectedProjectId.value = target.projectId
  await nextTick()
  await submit()
}

/** After a 409.3 formId collision: the form already exists on the server, so
 * retry as an update against that existing form rather than creating it again
 * (which can only fail identically). `submit` re-serializes from the live doc. */
const updateExistingInstead = async (): Promise<void> => {
  forceUpdateId.value = currentFormId.value
  conflict.value = null
  conflictMode.value = null
  await nextTick()
  await submit()
}

/** Recover from a version conflict (or, in create mode, as an alternative to
 * updating the existing form): stamp a fresh, guaranteed-distinct version onto
 * the live doc, then retry. `submit` re-serializes from the mutated doc, so the
 * synchronous `mutate` needs no autosave flush. */
const bumpAndRetry = async (): Promise<void> => {
  const doc = form.doc
  if (doc === null) return
  const next = bumpVersion(doc.settings.version)
  form.mutate(t('central.publish.undoBumpVersion'), (d) => { d.settings.version = next })
  conflict.value = null
  conflictMode.value = null
  await nextTick()
  await submit()
}

const reset = (): void => {
  targets.value = []
  selectedServerId.value = null
  selectedProjectId.value = null
  selectedFormId.value = null
  mode.value = 'create'
  forceUpdateId.value = null
  publishing.value = false
  progressText.value = ''
  result.value = null
  conflict.value = null
  conflictMode.value = null
  errorText.value = ''
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :style="{ width: '34rem' }"
    data-testid="publish-dialog"
    aria-labelledby="publish-dialog-title"
    @hide="reset"
  >
    <!-- Custom #header slot so the guide "?" sits beside the title without
         becoming part of the dialog's accessible name (see TranslationsDialog). -->
    <template #header>
      <div class="publish-header">
        <span id="publish-dialog-title" class="p-dialog-title">{{ t('central.publish.title') }}</span>
        <GuideTrigger guide="central" />
      </div>
    </template>

    <p class="publish-intro">{{ t('central.publish.intro') }}</p>

    <section v-if="targets.length > 0" class="publish-targets">
      <h4>{{ t('central.publish.recentTargets') }}</h4>
      <div
        v-for="target in targets"
        :key="target.id"
        class="publish-target"
        :data-testid="`publish-target-${target.id}`"
      >
        <div class="publish-target-info">
          <span class="publish-target-name">
            {{ t('central.publish.target', { project: target.projectId, server: serverName(target.serverId) }) }}
          </span>
          <code>{{ target.xmlFormId }}</code>
          <small>{{ t('central.publish.lastPublished', {
            version: target.lastPublishedVersion,
            date: formatDate(target.lastPublishedAt),
          }) }}</small>
        </div>
        <Button
          :label="t('central.publish.redeploy')"
          icon="pi pi-cloud-upload"
          size="small"
          severity="secondary"
          :disabled="publishing"
          :data-testid="`publish-redeploy-${target.id}`"
          @click="redeploy(target)"
        />
      </div>
    </section>

    <div class="publish-fields">
      <label class="prop-field">
        <span>{{ t('central.publish.serverLabel') }}</span>
        <div data-testid="publish-server-select">
          <CentralServerPicker v-model="selectedServerId" />
        </div>
      </label>

      <label class="prop-field">
        <span>{{ t('central.publish.projectLabel') }}</span>
        <div data-testid="publish-project-select">
          <CentralProjectPicker
            v-model="selectedProjectId"
            :server-id="selectedServerId"
            @error="(e) => { errorText = t(centralErrorKey(e)) }"
          />
        </div>
      </label>

      <fieldset v-if="selectedServerId !== null && selectedProjectId !== null" class="publish-mode">
        <legend>{{ t('central.publish.mode') }}</legend>
        <label class="publish-mode-option">
          <RadioButton v-model="mode" value="create" data-testid="publish-new-form" />
          <span>{{ t('central.publish.newForm') }}</span>
        </label>
        <label class="publish-mode-option">
          <RadioButton v-model="mode" value="update" data-testid="publish-update-existing" />
          <span>{{ t('central.publish.updateExisting') }}</span>
        </label>
      </fieldset>

      <label v-if="needsFormPicker" class="prop-field">
        <span>{{ t('central.publish.updateExisting') }}</span>
        <CentralFormPicker
          v-model="selectedFormId"
          :server-id="selectedServerId"
          :project-id="selectedProjectId"
          @error="(e) => { errorText = t(centralErrorKey(e)) }"
        />
      </label>
    </div>

    <Message
      v-if="renameMismatch && chosenTarget !== null"
      severity="warn"
      :closable="false"
      class="publish-notice"
      data-testid="publish-rename-warning"
    >
      {{ t('central.publish.renameWarning', { formId: currentFormId, server: serverName(chosenTarget.serverId) }) }}
    </Message>

    <p v-if="publishing && progressText !== ''" class="publish-progress" data-testid="publish-progress">
      {{ progressText }}
    </p>

    <Message
      v-if="conflict !== null"
      severity="error"
      :closable="false"
      class="publish-notice"
      data-testid="publish-conflict"
    >
      <div class="publish-conflict">
        <template v-if="conflictMode === 'create'">
          <strong>{{ t('central.publish.conflictTitle') }}</strong>
          <span>{{ t('central.publish.conflict', {
            formId: currentFormId,
            server: selectedServerId !== null ? serverName(selectedServerId) : '',
          }) }}</span>
        </template>
        <template v-else>
          <strong>{{ t('central.publish.conflictVersionTitle') }}</strong>
          <span>{{ t('central.publish.conflictVersion', {
            version: currentVersion,
            server: selectedServerId !== null ? serverName(selectedServerId) : '',
          }) }}</span>
        </template>
        <div class="publish-conflict-actions">
          <Button
            v-if="conflictMode === 'create'"
            :label="t('central.publish.updateInstead')"
            icon="pi pi-replay"
            size="small"
            :loading="publishing"
            data-testid="publish-update-instead"
            @click="updateExistingInstead"
          />
          <Button
            :label="t('central.publish.bumpVersion')"
            icon="pi pi-arrow-up"
            size="small"
            severity="secondary"
            :loading="publishing"
            data-testid="publish-bump-version"
            @click="bumpAndRetry"
          />
        </div>
      </div>
    </Message>

    <Message
      v-if="errorText !== ''"
      severity="error"
      :closable="false"
      class="publish-notice"
      data-testid="publish-error"
    >
      {{ errorText }}
    </Message>

    <div v-if="result !== null" class="publish-result" data-testid="publish-result">
      <Message severity="success" :closable="false" class="publish-notice">
        {{ t('central.publish.success', {
          project: selectedProjectId ?? '',
          server: selectedServerId !== null ? serverName(selectedServerId) : '',
        }) }}
      </Message>
      <div v-if="result.warnings.length > 0" class="publish-warnings" data-testid="publish-warnings">
        <strong>{{ t('central.publish.warningsTitle') }}</strong>
        <p>{{ t('central.publish.warningsIntro') }}</p>
        <ul>
          <li v-for="(warning, i) in result.warnings" :key="i">{{ warning }}</li>
        </ul>
      </div>
    </div>

    <template #footer>
      <Button :label="t('central.publish.close')" severity="secondary" text @click="visible = false" />
      <Button
        :label="t('central.publish.submit')"
        icon="pi pi-cloud-upload"
        :disabled="!canSubmit"
        :loading="publishing"
        data-testid="publish-submit"
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<style scoped>
@import '../properties/prop-section.css';

.publish-header {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
}

.publish-intro {
  margin: 0 0 var(--odk-spacing-l);
  line-height: 1.5;
}

.publish-targets {
  margin-bottom: var(--odk-spacing-l);
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}

.publish-targets h4 {
  margin: 0 0 var(--odk-spacing-xs);
  font-size: var(--odk-hint-font-size);
  font-weight: 600;
  color: var(--odk-muted-text-color);
}

.publish-target {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--odk-spacing-m);
  padding: var(--odk-spacing-s) var(--odk-spacing-m);
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
}

.publish-target-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.publish-target-name {
  font-weight: 500;
}

.publish-target-info code {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.publish-target-info small {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.publish-fields {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-l);
}

.publish-mode {
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
  padding: var(--odk-spacing-s) var(--odk-spacing-m);
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
  margin: 0;
}

.publish-mode legend {
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
  padding: 0 var(--odk-spacing-xs);
}

.publish-mode-option {
  display: flex;
  align-items: center;
  gap: var(--odk-spacing-s);
}

.publish-notice {
  margin-top: var(--odk-spacing-l);
}

.publish-progress {
  margin: var(--odk-spacing-m) 0 0;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.publish-conflict {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
  align-items: flex-start;
}

.publish-conflict-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--odk-spacing-s);
}

.publish-result {
  display: flex;
  flex-direction: column;
}

.publish-warnings {
  margin-top: var(--odk-spacing-m);
  font-size: var(--odk-hint-font-size);
}

.publish-warnings ul {
  margin: var(--odk-spacing-xs) 0 0;
  padding-inline-start: var(--odk-spacing-l);
}
</style>
