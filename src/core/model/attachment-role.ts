import { splitFilename } from './rename-attachment'
import type { AttachmentRef, AttachmentRole } from './types'

/** Fallback when nothing better is known (also re-exported by `workspace/archive.ts`). */
export const DEFAULT_MEDIATYPE = 'application/octet-stream'

/**
 * Classifies an attachment role from its filename extension / mimetype. Kept in
 * pure core (no Vue/store deps) so both the attachment-upload composable and the
 * Central import assembly can build `AttachmentRef.role` from the same rules.
 */
export const roleFor = (filename: string, mediatype: string): AttachmentRole => {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'csv') return 'csv'
  if (ext === 'geojson') return 'geojson'
  if (ext === 'xml') return 'xml'
  if (mediatype.startsWith('image/') || mediatype.startsWith('audio/') || mediatype.startsWith('video/')) return 'media'
  return 'other'
}

const MEDIATYPE_BY_EXT: Record<string, string> = {
  csv: 'text/csv',
  geojson: 'application/geo+json',
  xml: 'text/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  mp4: 'video/mp4',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
}

/**
 * Infers a mediatype from a filename extension. Zip entries (unlike Central's
 * attachment list) carry no Content-Type of their own, and `roleFor` above
 * classifies image/audio/video BY MEDIATYPE rather than extension — so a ZIP
 * importer needs this map to reconstruct a usable mediatype before it can
 * classify the role.
 */
export const mediatypeFor = (filename: string): string => {
  const ext = splitFilename(filename).ext.slice(1).toLowerCase()
  // hasOwn: `in` would walk the prototype chain, so "x.constructor" would
  // resolve to a function instead of a mediatype string.
  return Object.hasOwn(MEDIATYPE_BY_EXT, ext) ? MEDIATYPE_BY_EXT[ext] : DEFAULT_MEDIATYPE
}

/**
 * Rebuilds `FormDocument.attachments` refs from imported `{filename, mediatype,
 * blob}` triples (Central downloads, ZIP bundle media entries). Load-bearing for
 * every import assembly: the parsers leave `document.attachments = []`, so
 * without this rebuild every referenced file would look "referenced but not
 * uploaded" and exports would omit the blobs.
 */
export const attachmentRefsFor = (
  attachments: ReadonlyArray<{ filename: string, mediatype: string, blob: Blob }>
): AttachmentRef[] =>
  attachments.map(({ filename, mediatype, blob }) => ({
    // Placeholder id — the landing path (remapAttachments) mints the real,
    // storage-scoped id by filename, so this value is always overwritten.
    id: '',
    filename,
    mediatype,
    size: blob.size,
    role: roleFor(filename, mediatype),
  }))
