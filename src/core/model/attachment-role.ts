import type { AttachmentRole } from './types'

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
