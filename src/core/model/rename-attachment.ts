/**
 * Rename + reference-scan helpers for form attachments. Pure core: no Vue/
 * Pinia/Dexie/vue-i18n imports, no localization. Reused by the Attachments
 * dialog's rename modal (rewrite), reference-count badge and missing-row
 * detection (scan), and the "keep both" upload-conflict path (free-slot
 * naming).
 *
 * The reference traversal mirrors `src/core/validate/refs.ts` exactly (same
 * itemsetFile/implicit-csv-external/media/image-default shape), so
 * "referenced" means the same thing everywhere: rename rewriting, per-row
 * reference counts, missing-row detection and the refs validator all agree.
 */
import { imageDefaultFilename } from './defaults'
import { visit } from './ops'
import { MEDIA_KINDS, mediaFilenames } from './translations'
import { effectiveItemsetFile } from '../registry/question-types'
import type { FormDocument, MediaRefs } from './types'

const bump = (counts: Map<string, number>, filename: string): void => {
  counts.set(filename, (counts.get(filename) ?? 0) + 1)
}

/**
 * One traversal over every reference site in the document — question
 * itemsetFile (explicit or the csv-external implicit default), an image
 * question's default (attachment-picked template image), and
 * question-label / choice-label media (image/audio/video/bigImage) —
 * returning filename → occurrence count. Mirrors the traversal in
 * src/core/validate/refs.ts so "referenced" means the same thing there and
 * here. Drives the per-row reference counts AND the missing-row detection
 * (referenced filenames absent from doc.attachments): the key set includes
 * every referenced filename, whether or not it has an uploaded attachment.
 */
export const collectAttachmentReferences = (doc: FormDocument): Map<string, number> => {
  const counts = new Map<string, number>()

  visit(doc.children, (node) => {
    if (node.kind === 'question') {
      const itemsetFile = effectiveItemsetFile(node)
      if (itemsetFile !== undefined) bump(counts, itemsetFile)
      const defaultImage = imageDefaultFilename(node)
      if (defaultImage !== undefined) bump(counts, defaultImage)
    }
    for (const media of MEDIA_KINDS.map((kind) => node.media?.[kind])) {
      for (const filename of mediaFilenames(media)) bump(counts, filename)
    }
    return undefined
  })

  for (const list of Object.values(doc.choiceLists)) {
    for (const choice of list.choices) {
      for (const media of MEDIA_KINDS.map((kind) => choice.media?.[kind])) {
        for (const filename of mediaFilenames(media)) bump(counts, filename)
      }
    }
  }

  return counts
}

/** Per-filename count over collectAttachmentReferences (for call sites that scan a single name, e.g. the rename modal's summary line). */
export const countAttachmentReferences = (doc: FormDocument, filename: string): number =>
  collectAttachmentReferences(doc).get(filename) ?? 0

export type RenameAttachmentOutcome =
  | { ok: true, referencesUpdated: number }
  | { ok: false, reason: 'not-found' | 'extension-changed' | 'collision' }

/** Split at the last `.`: `ext` includes the dot and is '' when there is none. */
export const splitFilename = (filename: string): { stem: string, ext: string } => {
  const dot = filename.lastIndexOf('.')
  return dot === -1 ? { stem: filename, ext: '' } : { stem: filename.slice(0, dot), ext: filename.slice(dot) }
}

/**
 * Mutates `doc` in place (call from inside form.mutate): re-keys the
 * attachment ref's filename and rewrites every reference found by
 * collectAttachmentReferences, including materializing an implicit
 * csv-external default into an explicit itemsetFile when it matches `from`.
 * Defensively re-checks the extension-lock and collision rules even though
 * the UI is expected to enforce them first.
 */
export const renameAttachmentRefs = (doc: FormDocument, from: string, to: string): RenameAttachmentOutcome => {
  if (from === to) return { ok: true, referencesUpdated: 0 }

  const ref = doc.attachments.find((a) => a.filename === from)
  if (ref === undefined) return { ok: false, reason: 'not-found' }
  if (splitFilename(from).ext !== splitFilename(to).ext) return { ok: false, reason: 'extension-changed' }
  if (doc.attachments.some((a) => a.filename === to)) return { ok: false, reason: 'collision' }

  ref.filename = to
  let referencesUpdated = 0

  const renameMedia = (media: MediaRefs | undefined): void => {
    if (media === undefined) return
    for (const key of MEDIA_KINDS) {
      const text = media[key]
      if (text === undefined) continue
      for (const lang of Object.keys(text)) {
        if (text[lang] === from) {
          text[lang] = to
          referencesUpdated++
        }
      }
    }
  }

  visit(doc.children, (node) => {
    if (node.kind === 'question') {
      if (node.itemsetFile === from) {
        node.itemsetFile = to
        referencesUpdated++
      } else if (node.itemsetFile === undefined && node.type === 'csv-external' && `${node.name}.csv` === from) {
        // Materialize the implicit default into an explicit itemsetFile
        // under the new name — a rename never leaves a dangling reference.
        node.itemsetFile = to
        referencesUpdated++
      }
      if (imageDefaultFilename(node) === from) {
        // Rewrites bare; a legacy jr://images/-prefixed value normalizes to
        // the new bare filename via this same rename.
        node.defaultValue = to
        referencesUpdated++
      }
    }
    renameMedia(node.media)
    return undefined
  })

  for (const list of Object.values(doc.choiceLists)) {
    for (const choice of list.choices) renameMedia(choice.media)
  }

  return { ok: true, referencesUpdated }
}

/**
 * First free `name-2.ext`, `name-3.ext`, … not in `existing`. Returns
 * `filename` unchanged when it is not already in `existing`.
 */
export const firstFreeAttachmentName = (existing: ReadonlySet<string>, filename: string): string => {
  if (!existing.has(filename)) return filename
  const { stem, ext } = splitFilename(filename)
  let i = 2
  let candidate = `${stem}-${i}${ext}`
  while (existing.has(candidate)) {
    i++
    candidate = `${stem}-${i}${ext}`
  }
  return candidate
}
