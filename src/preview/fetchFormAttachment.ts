import { listAttachments } from '@/persistence/attachments-repo'

export type FetchFormAttachment = (url: URL) => Promise<Response>

/**
 * Resolves jr:// attachment URLs (itemset CSVs, media) against the form's
 * IndexedDB attachments. 404s let the engine apply missingResourceBehavior.
 */
export const makeFetchFormAttachment = (formRecordId: string): FetchFormAttachment =>
  async (url: URL): Promise<Response> => {
    const filename = decodeURIComponent(url.pathname.split('/').pop() ?? '')
    if (filename !== '') {
      const attachments = await listAttachments(formRecordId)
      const match = attachments.find((a) => a.filename === filename)
      if (match !== undefined) {
        return new Response(match.blob, {
          status: 200,
          headers: { 'Content-Type': match.mediatype },
        })
      }
    }
    return new Response(null, { status: 404 })
  }
