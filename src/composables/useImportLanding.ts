import { computed, ref, shallowRef } from 'vue'

import type { FormRecord } from '@/persistence/db'
import * as formsRepo from '@/persistence/forms-repo'

export interface ImportLandingOptions {
  /** The hosting dialog/drawer is still open — a mid-flight close skips the
   * finish/error hooks (the record may still land; nobody navigates to it). */
  isActive: () => boolean
  /** Host finish: close, toast, seed a publish target, navigate — host-specific. */
  onLanded: (record: FormRecord) => Promise<void> | void
  /** Host error surface (drawer Message, dialog Message, …). */
  onError: (err: unknown) => void
}

/**
 * Shared landing state machine for import surfaces that carry attachments —
 * the Import dialog's ZIP-bundle path and the library Central drawer: the
 * formId-collision lookup feeding `ImportCollisionPanel` (copy vs replace)
 * and the guarded landing itself. `landing` gates every entry point, so a
 * double-click can neither land twice nor run a second collision lookup
 * while the first is in flight.
 */
export const useImportLanding = (options: ImportLandingOptions) => {
  const landing = ref(false)
  // shallowRef: a FormRecord is plain persisted data; deep reactivity is noise.
  const collisionRecord = shallowRef<FormRecord | null>(null)
  const collisionPending = computed(() => collisionRecord.value !== null)

  const reset = (): void => {
    collisionRecord.value = null
  }

  const guarded = async (work: () => Promise<void>): Promise<void> => {
    if (landing.value) return
    landing.value = true
    try {
      await work()
    } finally {
      landing.value = false
    }
  }

  const landNow = async (create: () => Promise<FormRecord>): Promise<void> => {
    try {
      const record = await create()
      collisionRecord.value = null
      if (options.isActive()) await options.onLanded(record)
    } catch (err) {
      if (options.isActive()) options.onError(err)
    }
  }

  /** Land unconditionally (the user already resolved the collision). */
  const land = (create: () => Promise<FormRecord>): Promise<void> =>
    guarded(() => landNow(create))

  /** Land unless `formId` collides with an existing form — then surface the
   * collision (empty formId never collides). */
  const landOrCollide = (formId: string, create: () => Promise<FormRecord>): Promise<void> =>
    guarded(async () => {
      if (formId !== '') {
        const existing = (await formsRepo.listForms()).find((f) => f.formId === formId)
        if (existing !== undefined) {
          collisionRecord.value = existing
          return
        }
      }
      await landNow(create)
    })

  return { landing, collisionRecord, collisionPending, land, landOrCollide, reset }
}
