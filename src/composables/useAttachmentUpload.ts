import { roleFor } from '@/core/model/attachment-role'
import type { FormDocument } from '@/core/model/types'
import { translate } from '@/i18n'
import * as attachmentsRepo from '@/persistence/attachments-repo'
import type { AttachmentRecord } from '@/persistence/db'
import { useFormStore } from '@/stores/form'

export interface AttachFileOptions {
  /** Undo-history label; defaults to the attachments dialog's add label. */
  undoLabel?: string
  /** Extra document mutation applied inside the same undo entry (e.g. adopting the filename into `itemsetFile`). */
  alsoMutate?: (doc: FormDocument) => void
}

export interface UseAttachmentUpload {
  /**
   * Stores the file in the attachments repo (under `filenameOverride` when
   * given) and updates `doc.attachments` in one undo step. Returns null when
   * no form is open.
   */
  attachFile: (file: File, filenameOverride?: string, options?: AttachFileOptions) => Promise<AttachmentRecord | null>
}

/**
 * Shared upload path for form attachments: used by the Attachments dialog
 * and the property panel's choices-file upload. A re-upload under an existing
 * filename replaces the document ref but leaves the superseded
 * AttachmentRecord in IndexedDB, so undoing the replace restores a working
 * ref. Orphaned blobs are reclaimed when the form is closed (the form store's
 * close() prunes them once undo history is discarded).
 */
export const useAttachmentUpload = (): UseAttachmentUpload => {
  const form = useFormStore()

  const attachFile = async (
    file: File,
    filenameOverride?: string,
    options: AttachFileOptions = {}
  ): Promise<AttachmentRecord | null> => {
    if (form.recordId === null) return null
    const filename = filenameOverride ?? file.name
    const record = await attachmentsRepo.addAttachment(form.recordId, filename, file)
    form.mutate(options.undoLabel ?? translate('dialogs.attachments.undoAdd'), (d) => {
      // Replace any existing ref with the same filename (re-upload). The
      // superseded record stays in IndexedDB so undo can restore this ref;
      // close() prunes it if it ends up unreferenced.
      //
      // Build the entire next array from plain data in one shot, before ever
      // touching d.attachments: filtering-then-pushing *through* the reactive
      // `d` leaves a nested Vue reactive Proxy inside the surviving array,
      // which structuredClone() (in the form store's snapshotDoc) cannot
      // clone — every autosave/mutate after that throws until reload. Never
      // call an array-mutating method (push/splice/…) on a property reached
      // through the reactive `doc` argument; compute the next value from
      // plain data, then assign once.
      const next = d.attachments
        .filter((a) => a.filename !== filename)
        .map((a) => ({ ...a })) // de-proxy each surviving element (all-primitive fields)
      next.push({
        id: record.id,
        filename: record.filename,
        mediatype: record.mediatype,
        size: record.size,
        role: roleFor(record.filename, record.mediatype),
      })
      d.attachments = next
      options.alsoMutate?.(d)
    })
    return record
  }

  return { attachFile }
}
