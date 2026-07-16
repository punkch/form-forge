/**
 * ZIP export: form.xml (serialized XForm) OR form.xlsx (XLSForm workbook)
 * at the root, plus media/<filename> for every attachment reference whose
 * blob the caller can supply. Attachment refs without a stored blob become
 * warnings, never failures. The two variants share every step but the root
 * payload.
 */
import JSZip from 'jszip'

import type { FormDocument } from '../model/types'
import type { Issue } from '../validate/issues'
import { serializeXForm } from '../xform/serializer'
import { writeXlsForm } from '../xlsform/writer'

export interface ExportZipResult {
  data: Uint8Array
  issues: Issue[]
}

export type ZipVariant = 'xform' | 'xlsform'

const toBytes = async (content: Blob | Uint8Array): Promise<Uint8Array> =>
  content instanceof Uint8Array ? content : new Uint8Array(await content.arrayBuffer())

export const exportZip = async (
  doc: FormDocument,
  blobs: Map<string, Blob | Uint8Array>,
  variant: ZipVariant = 'xform'
): Promise<ExportZipResult> => {
  const zip = new JSZip()
  let issues: Issue[]

  if (variant === 'xlsform') {
    zip.file('form.xlsx', await writeXlsForm(doc))
    issues = []
  } else {
    const serialized = serializeXForm(doc)
    zip.file('form.xml', serialized.xml)
    issues = serialized.issues
  }

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
