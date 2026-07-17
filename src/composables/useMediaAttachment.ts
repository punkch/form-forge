import { computed, ref, type ComputedRef, type Ref } from 'vue'

import { useAttachmentUpload } from './useAttachmentUpload'
import { findNode } from '@/core/model/ops'
import { firstFreeAttachmentName } from '@/core/model/rename-attachment'
import {
  hasAnyText,
  langsOf,
  MEDIA_KINDS,
  mediaSlotState,
  setSiteText,
  type MediaSlot,
  type TranslationSiteRef,
} from '@/core/model/translations'
import type { FormDocument, Lang, LocalizedText, MediaRefs } from '@/core/model/types'
import { useAppI18n, type MessageKey } from '@/i18n'
import { useFormStore } from '@/stores/form'

/** Mirrors AttachmentConflictDialog's action union (kept local to avoid a
 * dependency from composables/ onto components/). */
export type MediaConflictAction = 'replace' | 'keep-both' | 'skip'

/** Result of a resolved upload: the filename it was finally stored under,
 * and — when that differs from the picked file's own name (sanitized or
 * keep-both suffixed) — the original name, for a "stored as" notice. */
export interface MediaUploadResult {
  storedAs: string
  renamedFrom?: string
}

/** i18n key per MEDIA_KIND, shared by every media-authoring surface
 * (LabelMediaSection, ChoicesSection's media popover) so the kind labels
 * never drift between them. */
export const MEDIA_KIND_LABEL_KEYS: Record<MediaSlot, MessageKey> = {
  image: 'properties.media.kindImage',
  audio: 'properties.media.kindAudio',
  video: 'properties.media.kindVideo',
  bigImage: 'properties.media.kindBigImage',
}

/** A leading '(' / ')' in a filename would later read as a dynamic default
 * expression (`isDynamicDefault`) once that name is ever used as an image
 * question's default — sanitize on upload so it never accidentally
 * classifies that way. */
export const sanitizeAttachmentFilename = (name: string): string => name.replace(/[()]/g, '-')

// --- shared slot/row projections --------------------------------------------
// Pure helpers behind every media-authoring surface's slot list and
// AttachmentPicker rows (LabelMediaSection's per-node rows, ChoicesSection's
// per-choice popover rows) — no composable state, so they're plain exports
// rather than part of useMediaAttachment's return.

/** Slots to render as rows: those already carrying a value in at least one
 * language, plus any explicitly activated-but-still-empty slots (the "Add
 * media" menu's just-added, not-yet-filled row). */
export const visibleMediaSlots = (media: MediaRefs | undefined, activated: ReadonlySet<MediaSlot>): MediaSlot[] =>
  MEDIA_KINDS.filter((slot) => hasAnyText(media?.[slot]) || activated.has(slot))

/** The complement of visibleMediaSlots — kinds still offered in the "Add
 * media" menu. */
export const addableMediaSlots = (visible: readonly MediaSlot[]): MediaSlot[] =>
  MEDIA_KINDS.filter((slot) => !visible.includes(slot))

export interface MediaPickerRow {
  slot: MediaSlot
  /** The one filename every language agrees on, or null when unset. */
  filename: string | null
  /** Set values diverge across the document's current languages. */
  varies: boolean
  /** Filename is set but names no attachment in doc.attachments. */
  missing: boolean
}

/** One AttachmentPicker row per given slot: its shared filename (or
 * null/varying across `langs`), and whether that filename is missing from
 * the document's attachments. */
export const mediaRowsFor = (
  media: MediaRefs | undefined,
  slots: readonly MediaSlot[],
  langs: readonly Lang[],
  attachedFilenames: ReadonlySet<string>
): MediaPickerRow[] =>
  slots.map((slot) => {
    const state = mediaSlotState(media?.[slot], langs)
    return {
      slot,
      filename: state.filename,
      varies: state.varies,
      missing: state.filename !== null && !attachedFilenames.has(state.filename),
    }
  })

const readMediaText = (doc: FormDocument, site: TranslationSiteRef): LocalizedText | undefined => {
  if (site.kind === 'node-media') return findNode(doc, site.nodeId)?.media?.[site.slot]
  if (site.kind === 'choice-media') return doc.choiceLists[site.listName]?.choices[site.choiceIndex]?.media?.[site.slot]
  return undefined
}

const writeFanOutAll = (doc: FormDocument, site: TranslationSiteRef, filename: string): void => {
  for (const lang of langsOf(doc)) setSiteText(doc, site, lang, filename)
}

/** Rewrites only languages currently holding `oldFilename` — a deliberate
 * per-language override (a different value, or none at all) survives. */
const writeMatchingOnly = (doc: FormDocument, site: TranslationSiteRef, oldFilename: string, filename: string): void => {
  const text = readMediaText(doc, site)
  for (const lang of langsOf(doc)) {
    if ((text?.[lang] ?? '') === oldFilename) setSiteText(doc, site, lang, filename)
  }
}

export interface UseMediaAttachment {
  /** The file awaiting a same-name-collision decision, or null when idle —
   * bind straight to AttachmentConflictDialog's `file` prop. */
  conflictFile: Ref<File | null>
  /** Resolve the pending conflict — bind to the dialog's `resolve` event. */
  resolveConflict: (payload: { action: MediaConflictAction }) => void
  /** The bare filenames present in the open form's attachments — the shared
   * "is this filename missing" source for every AttachmentPicker row. */
  attachedFilenames: ComputedRef<Set<string>>
  /** Localized label for a MEDIA_KIND, e.g. 'Image' — shared across every
   * media row and its undo-history labels. */
  kindLabel: (slot: MediaSlot) => string
  /**
   * PICK / CLEAR for a localized media slot (the Select in AttachmentPicker).
   * A non-null filename fans out to every current language in one undo step;
   * null clears only languages still holding the slot's current filename
   * (an override elsewhere survives).
   */
  pickMediaRef: (site: TranslationSiteRef, filename: string | null, undoLabel: string) => void
  /**
   * UPLOAD for a localized media slot: stores the file (sanitizing the name
   * and resolving a same-name collision via the conflict dialog first), then
   * writes the resulting filename in the same undo step — fanning out to
   * every language when the slot was unset or diverging, or rewriting only
   * languages that held the old filename when it wasn't (a REPLACE).
   * Resolves to null when the user chose Skip.
   */
  uploadMediaRef: (site: TranslationSiteRef, file: File, undoLabel: string) => Promise<MediaUploadResult | null>
  /**
   * UPLOAD for an unlocalized single-value attachment slot (the image
   * question's default). Same store/sanitize/conflict handling as
   * uploadMediaRef, but `write` decides the doc mutation itself.
   */
  uploadSingle: (
    file: File,
    undoLabel: string,
    write: (doc: FormDocument, filename: string) => void
  ) => Promise<MediaUploadResult | null>
}

/**
 * Shared write + upload-conflict logic behind AttachmentPicker's parents
 * (LabelMediaSection, ChoicesSection's media popover, BasicSection's
 * default-image row) — one undo step per pick/upload, and the "shared media
 * across translations" fan-out/override-preserving rules from the media
 * authoring spec. Each call owns independent conflict-dialog state, so a
 * parent component mounts exactly one <AttachmentConflictDialog> against it.
 */
export const useMediaAttachment = (): UseMediaAttachment => {
  const form = useFormStore()
  const { t } = useAppI18n()
  const { attachFile } = useAttachmentUpload()

  const conflictFile = ref<File | null>(null)
  let conflictResolve: ((action: MediaConflictAction) => void) | null = null

  const attachedFilenames = computed(() => new Set((form.doc?.attachments ?? []).map((a) => a.filename)))
  const kindLabel = (slot: MediaSlot): string => t(MEDIA_KIND_LABEL_KEYS[slot])

  const resolveConflict = (payload: { action: MediaConflictAction }): void => {
    conflictFile.value = null
    conflictResolve?.(payload.action)
    conflictResolve = null
  }

  const waitForConflict = (file: File): Promise<MediaConflictAction> => {
    conflictFile.value = file
    return new Promise((resolve) => { conflictResolve = resolve })
  }

  /** Sanitizes, resolves a same-name collision (if any) via the conflict
   * dialog, stores the blob under the resolved name, and returns it — or
   * null on Skip. Doesn't write any document reference itself. */
  const storeUpload = async (
    file: File,
    undoLabel: string,
    alsoMutate: (doc: FormDocument, storedAs: string) => void
  ): Promise<MediaUploadResult | null> => {
    const doc = form.doc
    if (doc === null) return null
    const sanitized = sanitizeAttachmentFilename(file.name)
    let storedAs = sanitized
    if (doc.attachments.some((a) => a.filename === sanitized)) {
      const action = await waitForConflict(file)
      if (action === 'skip') return null
      if (action === 'keep-both') {
        const known = new Set(doc.attachments.map((a) => a.filename))
        storedAs = firstFreeAttachmentName(known, sanitized)
      }
      // 'replace' keeps storedAs === sanitized (overwrites the existing blob).
    }
    await attachFile(file, storedAs, { undoLabel, alsoMutate: (d) => alsoMutate(d, storedAs) })
    return { storedAs, renamedFrom: storedAs !== file.name ? file.name : undefined }
  }

  const pickMediaRef = (site: TranslationSiteRef, filename: string | null, undoLabel: string): void => {
    form.mutate(undoLabel, (doc) => {
      if (filename !== null) {
        writeFanOutAll(doc, site, filename)
        return
      }
      const state = mediaSlotState(readMediaText(doc, site), langsOf(doc))
      if (state.varies) {
        // No single old filename to preserve overrides against — a diverged
        // slot's Clear is a deliberate full reset.
        writeFanOutAll(doc, site, '')
      } else if (state.filename !== null) {
        writeMatchingOnly(doc, site, state.filename, '')
      }
    })
  }

  const uploadMediaRef = (site: TranslationSiteRef, file: File, undoLabel: string): Promise<MediaUploadResult | null> =>
    storeUpload(file, undoLabel, (d, storedAs) => {
      // Read the slot's state against the post-await doc: the store step
      // (IndexedDB write, possibly a user-paced conflict dialog) is async,
      // and a state captured at click time could silently mismatch a write
      // that landed on the same slot in the meantime.
      const state = mediaSlotState(readMediaText(d, site), langsOf(d))
      if (!state.varies && state.filename !== null) writeMatchingOnly(d, site, state.filename, storedAs)
      else writeFanOutAll(d, site, storedAs)
    })

  const uploadSingle = (
    file: File,
    undoLabel: string,
    write: (doc: FormDocument, filename: string) => void
  ): Promise<MediaUploadResult | null> => storeUpload(file, undoLabel, write)

  return { conflictFile, resolveConflict, attachedFilenames, kindLabel, pickMediaRef, uploadMediaRef, uploadSingle }
}
