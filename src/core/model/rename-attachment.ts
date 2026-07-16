/**
 * Rename + reference-scan helpers for form attachments. Pure core: no Vue/
 * Pinia/Dexie/vue-i18n imports, no localization. Reused by the Attachments
 * dialog's rename modal (rewrite), reference-count badge and missing-row
 * detection (scan), and the "keep both" upload-conflict path (free-slot
 * naming).
 *
 * The reference traversal mirrors `src/core/validate/refs.ts` exactly (same
 * itemsetFile/implicit-csv-external/media shape), so "referenced" means the
 * same thing everywhere: rename rewriting, per-row reference counts, missing-
 * row detection and the refs validator all agree.
 */
import { visit } from './ops'
import { effectiveItemsetFile } from '../registry/question-types'
import type { FormDocument, LocalizedText, MediaRefs } from './types'

const mediaFilenames = (text: LocalizedText | undefined): string[] =>
  text === undefined ? [] : Object.values(text).filter((v): v is string => !!v && v.trim() !== '')

const bump = (counts: Map<string, number>, filename: string): void => {
  counts.set(filename, (counts.get(filename) ?? 0) + 1)
}

/**
 * One traversal over every reference site in the document — question
 * itemsetFile (explicit or the csv-external implicit default) and
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
    }
    for (const media of [node.media?.image, node.media?.audio, node.media?.video, node.media?.bigImage]) {
      for (const filename of mediaFilenames(media)) bump(counts, filename)
    }
    return undefined
  })

  for (const list of Object.values(doc.choiceLists)) {
    for (const choice of list.choices) {
      for (const media of [choice.media?.image, choice.media?.audio, choice.media?.video, choice.media?.bigImage]) {
        for (const filename of mediaFilenames(media)) bump(counts, filename)
      }
    }
  }

  return counts
}

export interface AttachmentReferenceScan {
  count: number
}

/** Per-filename view over collectAttachmentReferences (kept for call sites that scan a single name, e.g. the rename modal's summary line). */
export const scanAttachmentReferences = (doc: FormDocument, filename: string): AttachmentReferenceScan => ({
  count: collectAttachmentReferences(doc).get(filename) ?? 0,
})

export type RenameAttachmentOutcome =
  | { ok: true, referencesUpdated: number }
  | { ok: false, reason: 'not-found' | 'extension-changed' | 'collision' }

/** Last `.`-delimited suffix, including the dot; '' when there is no dot. */
const extensionOf = (filename: string): string => {
  const dot = filename.lastIndexOf('.')
  return dot === -1 ? '' : filename.slice(dot)
}

/**
 * Mutates `doc` in place (call from inside form.mutate): re-keys the
 * attachment ref's filename and rewrites every reference found by
 * scanAttachmentReferences, including materializing an implicit
 * csv-external default into an explicit itemsetFile when it matches `from`.
 * Defensively re-checks the extension-lock and collision rules even though
 * the UI is expected to enforce them first.
 */
export const renameAttachmentRefs = (doc: FormDocument, from: string, to: string): RenameAttachmentOutcome => {
  if (from === to) return { ok: true, referencesUpdated: 0 }

  const ref = doc.attachments.find((a) => a.filename === from)
  if (ref === undefined) return { ok: false, reason: 'not-found' }
  if (extensionOf(from) !== extensionOf(to)) return { ok: false, reason: 'extension-changed' }
  if (doc.attachments.some((a) => a.filename === to)) return { ok: false, reason: 'collision' }

  ref.filename = to
  let referencesUpdated = 0

  const renameMedia = (media: MediaRefs | undefined): void => {
    if (media === undefined) return
    for (const key of ['image', 'audio', 'video', 'bigImage'] as const) {
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
  const dot = filename.lastIndexOf('.')
  const stem = dot === -1 ? filename : filename.slice(0, dot)
  const ext = dot === -1 ? '' : filename.slice(dot)
  let i = 2
  let candidate = `${stem}-${i}${ext}`
  while (existing.has(candidate)) {
    i++
    candidate = `${stem}-${i}${ext}`
  }
  return candidate
}
