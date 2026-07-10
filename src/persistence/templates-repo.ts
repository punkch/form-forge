import { documentPreviewLabels } from '@/core/model/display'
import { newId } from '@/core/model/ids'
import { countQuestions } from '@/core/model/ops'
import type { FormDocument } from '@/core/model/types'

import { db, type TemplateRecord } from './db'

const PREVIEW_LABELS = 5

/** First few question labels (best display value) — the gallery preview. */
export const templatePreview = (doc: FormDocument): string[] =>
  documentPreviewLabels(doc, PREVIEW_LABELS)

export const listTemplates = (): Promise<TemplateRecord[]> =>
  db.templates.orderBy('updatedAt').reverse().toArray()

/**
 * Store a local template from a form document. The doc is deep-cloned via a
 * JSON round-trip (like cloneSubtree: transparent to Vue reactive proxies)
 * and stripped of attachment refs — blobs stay with the source form.
 */
export const addTemplate = async (
  doc: FormDocument,
  title: string,
  description: string
): Promise<TemplateRecord> => {
  const stored = JSON.parse(JSON.stringify(doc)) as FormDocument
  stored.attachments = []
  const now = Date.now()
  const record: TemplateRecord = {
    id: newId(),
    title,
    description,
    questionCount: countQuestions(stored),
    preview: templatePreview(stored),
    createdAt: now,
    updatedAt: now,
    doc: stored,
  }
  await db.templates.add(record)
  return record
}

export const deleteTemplate = (id: string): Promise<void> => db.templates.delete(id)
