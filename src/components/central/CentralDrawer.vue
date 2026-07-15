<script setup lang="ts">
/**
 * The per-form ODK Central hub — the body of a non-modal, right-side slide-over
 * (chrome + vault gate live in `CentralDrawerShell`). It holds the current draft
 * version, every destination this form has been published to (with a local
 * freshness chip and one-click re-publish rendered inline), a per-row "Check
 * server" reconcile, and an inline "publish to a new destination" flow. The form
 * stays visible/editable behind it — publishing here never covers the canvas.
 *
 * Vault state is global (one key unlocks every server), so the header shows a
 * single "Vault unlocked · Lock" control, never a per-server lock. The per-row
 * signal is freshness (a purely local content compare), not connection.
 */
import Button from 'primevue/button'
import { computed, ref, toRaw, watch } from 'vue'

import CentralDrawerShell from '@/components/central/CentralDrawerShell.vue'
import DestinationRow from '@/components/central/DestinationRow.vue'
import NewDestinationForm from '@/components/central/NewDestinationForm.vue'
import PublishFlowStatus from '@/components/central/PublishFlowStatus.vue'
import { contentFingerprint } from '@/core/central/fingerprint'
import { freshnessFor, reconcileTarget, type FreshnessState } from '@/core/central/reconcile'
import type { FormDocument } from '@/core/model/types'
import type { PublishTargetRecord } from '@/persistence/db'
import { usePublishFlow, type PublishDestination } from '@/composables/usePublishFlow'
import { useAppI18n } from '@/i18n'
import { useCentralStore } from '@/stores/central'
import { useEditorStore } from '@/stores/editor'
import { useFormStore } from '@/stores/form'

/** `activeTargetId` sentinel for the new-destination flow (real target ids are
 * generated and never collide with this). */
const NEW_DESTINATION = 'new'

const { t } = useAppI18n()
const form = useFormStore()
const central = useCentralStore()
const editor = useEditorStore()

const flow = usePublishFlow()

const targets = ref<PublishTargetRecord[]>([])
/** SHA-256 of the current form's version-neutralized XForm; null until computed. */
const currentHash = ref<string | null>(null)
/** Which row (target id) or the new-destination sentinel is currently publishing. */
const activeTargetId = ref<string | null>(null)
const newDestOpen = ref(false)
/** Target id whose Check-server read is in flight. */
const checkingId = ref<string | null>(null)
const checkLabels = ref<Record<string, string>>({})

const currentVersion = computed((): string => form.doc?.settings.version ?? '')
const currentFormId = computed((): string => form.doc?.settings.formId ?? '')

const serverFor = (id: string) => central.servers.find((s) => s.id === id)
const serverName = (id: string): string => serverFor(id)?.name ?? id
const hasPassword = (id: string): boolean => serverFor(id)?.encryptedPassword !== undefined

const freshnessOf = (target: PublishTargetRecord): FreshnessState =>
  // A hash we haven't computed yet (null on first paint) shouldn't flip every
  // row to "changed"; treat it as not-yet-compared until the fingerprint lands.
  currentHash.value === null
    ? 'unknown'
    : freshnessFor(currentHash.value, target.lastPublishedContentHash)

// --- The active destination's context, shared by both flow-status mount points -
const activeServerName = computed((): string =>
  flow.activeDestination.value !== null ? serverName(flow.activeDestination.value.serverId) : '')
const activeProjectId = computed((): number | null => flow.activeDestination.value?.projectId ?? null)

const flowStatusProps = computed(() => ({
  publishing: flow.publishing.value,
  progressText: flow.progressText.value,
  conflict: flow.conflict.value,
  conflictMode: flow.conflictMode.value,
  result: flow.result.value,
  errorText: flow.errorText.value,
  serverName: activeServerName.value,
  currentFormId: currentFormId.value,
  currentVersion: currentVersion.value,
  projectId: activeProjectId.value,
}))

// --- Data loads ---------------------------------------------------------------
const loadTargets = async (): Promise<void> => {
  const id = form.recordId
  targets.value = id === null
    ? []
    : (await central.listTargetsForForm(id)).slice().sort((a, b) => b.lastPublishedAt - a.lastPublishedAt)
}

let hashGeneration = 0
const recomputeHash = async (): Promise<void> => {
  const doc = form.doc
  if (doc === null) { currentHash.value = null; return }
  // A generation token so a slow serialize+hash can't clobber a newer one.
  const generation = ++hashGeneration
  const hash = await contentFingerprint(toRaw(doc) as FormDocument)
  if (generation === hashGeneration) currentHash.value = hash
}

watch(() => [editor.centralDrawerOpen, form.recordId], () => {
  if (!editor.centralDrawerOpen) {
    flow.reset()
    activeTargetId.value = null
    newDestOpen.value = false
    checkLabels.value = {}
    return
  }
  void loadTargets()
  void recomputeHash()
}, { immediate: true })

// The form stays editable while the drawer is open, so keep freshness live:
// form.revision bumps on every content mutation (mutate/undo/redo).
watch(() => form.revision, () => {
  if (editor.centralDrawerOpen) void recomputeHash()
})

// --- Actions ------------------------------------------------------------------
const refreshAfterPublish = async (): Promise<void> => {
  if (flow.result.value !== null) {
    await loadTargets()
    await recomputeHash()
  }
}

const republish = async (target: PublishTargetRecord): Promise<void> => {
  activeTargetId.value = target.id
  await flow.run({
    serverId: target.serverId,
    projectId: target.projectId,
    xmlFormId: target.xmlFormId,
    mode: 'update',
  })
  await refreshAfterPublish()
}

const publishNew = async (destination: PublishDestination): Promise<void> => {
  activeTargetId.value = NEW_DESTINATION
  await flow.run(destination)
  await refreshAfterPublish()
}

/** 409-recovery buttons run a flow method then refresh, so the recovered row's
 * metadata + freshness update in place (not just after a reopen). */
const recover = async (retry: () => Promise<void>): Promise<void> => {
  await retry()
  await refreshAfterPublish()
}

const checkServer = async (target: PublishTargetRecord): Promise<void> => {
  checkingId.value = target.id
  try {
    const summaries = await central.listForms(target.serverId, target.projectId)
    const verdict = reconcileTarget(target, summaries)
    let label: string
    switch (verdict.kind) {
      case 'matches': label = t('central.drawer.checkMatches'); break
      case 'version-differs': label = t('central.drawer.checkVersionDiffers', { version: verdict.centralVersion }); break
      default: label = t('central.drawer.checkNeverPublished')
    }
    checkLabels.value = { ...checkLabels.value, [target.id]: label }
  } catch {
    checkLabels.value = { ...checkLabels.value, [target.id]: t('central.drawer.checkError') }
  } finally {
    checkingId.value = null
  }
}

const close = (): void => { editor.centralDrawerOpen = false }
</script>

<template>
  <CentralDrawerShell
    variant="editor"
    testid="central-drawer"
    close-testid="central-drawer-close"
    @close="close"
  >
    <div class="central-hub">
      <div class="central-vault-bar">
        <span class="central-vault-state">
          <i class="pi pi-lock-open" />
          {{ t('central.drawer.vaultUnlocked') }}
        </span>
        <Button
          :label="t('central.drawer.lock')"
          icon="pi pi-lock"
          severity="secondary"
          text
          size="small"
          data-testid="central-lock"
          @click="central.lockVault()"
        />
      </div>

      <div class="central-draft">
        <span class="central-draft-label">{{ t('central.drawer.currentDraft') }}</span>
        <code class="central-draft-version">{{ currentVersion }}</code>
      </div>
      <p class="central-draft-note">{{ t('central.drawer.draftNote') }}</p>

      <section class="central-destinations">
        <h3 class="central-section-heading">{{ t('central.drawer.destinationsHeading') }}</h3>

        <p v-if="targets.length === 0" class="central-empty" data-testid="central-no-destinations">
          {{ t('central.drawer.noDestinations') }}
        </p>

        <DestinationRow
          v-for="target in targets"
          :key="target.id"
          :target="target"
          :server-name="serverName(target.serverId)"
          :has-password="hasPassword(target.serverId)"
          :freshness="freshnessOf(target)"
          :busy="flow.publishing.value"
          :check-label="checkLabels[target.id] ?? null"
          :checking="checkingId === target.id"
          @republish="republish(target)"
          @check="checkServer(target)"
        >
          <template #flow>
            <PublishFlowStatus
              v-if="activeTargetId === target.id"
              v-bind="flowStatusProps"
              @update-instead="recover(flow.updateExistingInstead)"
              @bump="recover(flow.bumpAndRetry)"
            />
          </template>
        </DestinationRow>
      </section>

      <div class="central-new-wrap">
        <NewDestinationForm v-model:open="newDestOpen" :busy="flow.publishing.value" @submit="publishNew" />
        <PublishFlowStatus
          v-if="activeTargetId === NEW_DESTINATION"
          v-bind="flowStatusProps"
          @update-instead="recover(flow.updateExistingInstead)"
          @bump="recover(flow.bumpAndRetry)"
        />
      </div>
    </div>
  </CentralDrawerShell>
</template>

<style scoped>
.central-hub {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-l);
}

.central-vault-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--odk-spacing-s);
  padding: var(--builder-spacing-xs) var(--odk-spacing-m);
  border: 1px solid var(--odk-border-color);
  border-radius: var(--odk-radius);
  background: var(--odk-alt-background-color, transparent);
}

.central-vault-state {
  display: flex;
  align-items: center;
  gap: var(--builder-spacing-xs);
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
}

.central-draft {
  display: flex;
  align-items: baseline;
  gap: var(--odk-spacing-s);
}

.central-draft-label {
  font-weight: 600;
}

.central-draft-note {
  margin: 0;
  font-size: var(--odk-hint-font-size);
  color: var(--odk-muted-text-color);
  line-height: 1.4;
}

.central-destinations {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-m);
}

.central-section-heading {
  margin: 0;
  font-size: var(--odk-hint-font-size);
  font-weight: 600;
  color: var(--odk-muted-text-color);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.central-empty {
  margin: 0;
  color: var(--odk-muted-text-color);
}

.central-new-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--odk-spacing-s);
}
</style>
