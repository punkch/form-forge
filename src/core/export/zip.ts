/**
 * ZIP export: form.xml (serialized XForm) at the root plus media/<filename>
 * for every attachment reference whose blob the caller can supply.
 * Attachment refs without a stored blob become warnings, never failures.
 */
import JSZip from 'jszip'

import type { FormDocument } from '../model/types'
import type { Issue } from '../validate/issues'
import { serializeXForm } from '../xform/serializer'

export interface ExportZipResult {
  data: Uint8Array
  issues: Issue[]
}

const toBytes = async (content: Blob | Uint8Array): Promise<Uint8Array> =>
  content instanceof Uint8Array ? content : new Uint8Array(await content.arrayBuffer())

export const exportZip = async (
  doc: FormDocument,
  blobs: Map<string, Blob | Uint8Array>
): Promise<ExportZipResult> => {
  const { xml, issues } = serializeXForm(doc)
  const zip = new JSZip()
  zip.file('form.xml', xml)

  for (const ref of doc.attachments) {
    const content = blobs.get(ref.id)
    if (content === undefined) {
      issues.push({
        severity: 'warning',
        code: 'export.missing-attachment',
        message: `No stored file for attachment "${ref.filename}"; it was left out of the ZIP.`,
        scope: {},
      })
      continue
    }
    zip.file(`media/${ref.filename}`, await toBytes(content))
  }

  const data = await zip.generateAsync({ type: 'uint8array' })
  return { data, issues }
}
