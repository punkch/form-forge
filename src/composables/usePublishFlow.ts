/**
 * The publish state machine, shared by the Central drawer's per-destination
 * re-publish and its "new destination" flow.
 *
 * Extracted from the old `PublishDialog.vue` so the drawer can run one publish
 * at a time against an explicit destination (server × project × xmlFormId ×
 * mode) and render the lifecycle (progress → conflict recovery → result) inline.
 * The store keeps the transport client + session token private — this only calls
 * `central.publishForm(...)`.
 *
 * On success it records the destination as a publish target, stamping the
 * content fingerprint (`src/core/central/fingerprint.ts`) so the drawer can later
 * tell "Up to date" from "Changed" with no network call.
 */
import { ref, toRaw } from 'vue'

import { contentFingerprint } from '@/core/central/fingerprint'
import type { CentralPublishResult, PublishMode, PublishProgress } from '@/core/central/publish'
import { CentralError } from '@/core/central/types'
import type { FormDocument } from '@/core/model/types'
import { bumpVersion } from '@/core/model/version'
import type { ArchiveAttachment } from '@/core/workspace/archive'
import { serializeXForm } from '@/core/xform/serializer'
import { useAppI18n } from '@/i18n'
import { centralErrorKey } from '@/i18n/central-errors'
import { listAttachments } from '@/persistence/attachments-repo'
import { useCentralStore } from '@/stores/central'
import { useFormStore } from '@/stores/form'

/** One publish destination plus whether it creates a new Central form or updates
 * an existing one's draft. */
export interface PublishDestination {
  serverId: string
  projectId: number
  xmlFormId: string
  mode: PublishMode
}

export const usePublishFlow = () => {
  const { t } = useAppI18n()
  const form = useFormStore()
  const central = useCentralStore()

  const publishing = ref(false)
  const progressText = ref('')
  const result = ref<CentralPublishResult | null>(null)
  const conflict = ref<CentralError | null>(null)
  /** The mode of the publish that hit the conflict — a create-mode collision
   * offers "update instead" + bump; an update-mode version clash offers only the
   * bump. Null when no conflict is showing. */
  const conflictMode = ref<PublishMode | null>(null)
  const errorText = ref('')
  /** The destination the current/last publish targeted — drives conflict-recovery
   * retries against the same place. */
  const activeDestination = ref<PublishDestination | null>(null)

  const clearOutcome = (): void => {
    result.value = null
    conflict.value = null
    conflictMode.value = null
    errorText.value = ''
  }

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

  /** Publish the open form's current draft to `dest`. Resolves whether it
   * succeeded (see `result`) or surfaced a conflict/error (`conflict`/`errorText`);
   * never throws for a transport failure. */
  const run = async (dest: PublishDestination): Promise<void> => {
    const doc = form.doc
    const recordId = form.recordId
    if (doc === null || recordId === null) return

    activeDestination.value = dest
    publishing.value = true
    progressText.value = ''
    clearOutcome()
    try {
      const rawDoc = toRaw(doc) as FormDocument
      const { xml } = serializeXForm(rawDoc)
      const contentHash = await contentFingerprint(rawDoc)
      const records = await listAttachments(recordId)
      const attachments: ArchiveAttachment[] = records.map((a) => ({
        filename: a.filename,
        mediatype: a.mediatype,
        blob: a.blob,
      }))

      const publishResult = await central.publishForm(dest.serverId, dest.projectId, {
        xml,
        attachments,
        xmlFormId: dest.xmlFormId,
        mode: dest.mode,
        onProgress,
      })

      await central.upsertTarget({
        formRecordId: recordId,
        serverId: dest.serverId,
        projectId: dest.projectId,
        xmlFormId: dest.xmlFormId,
        lastPublishedVersion: doc.settings.version ?? '',
        lastPublishedAt: Date.now(),
        lastPublishedContentHash: contentHash,
      })
      result.value = publishResult
    } catch (error) {
      if (error instanceof CentralError && error.kind === 'conflict') {
        conflict.value = error
        conflictMode.value = dest.mode
      } else {
        errorText.value = t(centralErrorKey(error))
      }
    } finally {
      publishing.value = false
      progressText.value = ''
    }
  }

  /** After a 409.3 formId collision: the form already exists on the server, so
   * retry as an update against that existing form rather than creating it again
   * (which can only fail identically). */
  const updateExistingInstead = async (): Promise<void> => {
    const dest = activeDestination.value
    if (dest === null) return
    conflict.value = null
    conflictMode.value = null
    await run({ ...dest, mode: 'update' })
  }

  /** Recover from a version conflict: stamp a fresh, guaranteed-distinct version
   * onto the live doc, then retry the same destination. `run` re-serializes from
   * the mutated doc, so the synchronous `mutate` needs no autosave flush. */
  const bumpAndRetry = async (): Promise<void> => {
    const doc = form.doc
    const dest = activeDestination.value
    if (doc === null || dest === null) return
    const next = bumpVersion(doc.settings.version)
    form.mutate(t('central.publish.undoBumpVersion'), (d) => { d.settings.version = next })
    conflict.value = null
    conflictMode.value = null
    await run(dest)
  }

  const reset = (): void => {
    publishing.value = false
    progressText.value = ''
    clearOutcome()
    activeDestination.value = null
  }

  return {
    publishing,
    progressText,
    result,
    conflict,
    conflictMode,
    errorText,
    activeDestination,
    run,
    updateExistingInstead,
    bumpAndRetry,
    reset,
  }
}
