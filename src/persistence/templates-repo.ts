import { documentPreviewLabels } from '@/core/model/display'
import { newId } from '@/core/model/ids'
import { countQuestions } from '@/core/model/ops'
import type { FormDocument } from '@/core/model/types'

import { getPersistenceBackend } from './backend'
import { type TemplateRecord } from './db'

const PREVIEW_LABELS = 5

/** First few question labels (best display value) — the gallery preview. */
export const templatePreview = (doc: FormDocument): string[] =>
  documentPreviewLabels(doc, PREVIEW_LABELS)

export const listTemplates = (): Promise<TemplateRecord[]> =>
  getPersistenceBackend().listTemplates()

/**
 * Deep-clone a doc for template storage via a JSON round-trip (like
 * cloneSubtree: transparent to Vue reactive proxies), stripped of attachment
 * refs (blobs stay with the source form), plus its derived question count and
 * gallery preview — shared by every write path that stores a doc snapshot.
 */
const deriveTemplateFields = (
  doc: FormDocument
): { doc: FormDocument, questionCount: number, preview: string[] } => {
  const stored = JSON.parse(JSON.stringify(doc)) as FormDocument
  stored.attachments = []
  return { doc: stored, questionCount: countQuestions(stored), preview: templatePreview(stored) }
}

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
  const now = Date.now()
  const record: TemplateRecord = {
    id: newId(),
    title,
    description,
    createdAt: now,
    updatedAt: now,
    ...deriveTemplateFields(doc),
  }
  await getPersistenceBackend().addTemplate(record)
  return record
}

/**
 * Metadata-only edit: rename/redescribe a template in place. Leaves the
 * stored doc, createdAt, questionCount and preview untouched. No-ops when the
 * template no longer exists.
 */
export const updateTemplate = async (
  id: string,
  fields: { title: string, description: string }
): Promise<void> => {
  const backend = getPersistenceBackend()
  const existing = await backend.getTemplate(id)
  if (existing === undefined) return
  await backend.putTemplate({ ...existing, ...fields, updatedAt: Date.now() })
}

/**
 * Overwrite-on-save: replace a template's doc (and title/description) with a
 * fresh snapshot, recomputing the derived question count and preview.
 * Preserves the existing record's createdAt. No-ops when the template no
 * longer exists.
 */
export const replaceTemplate = async (
  id: string,
  doc: FormDocument,
  title: string,
  description: string
): Promise<void> => {
  const backend = getPersistenceBackend()
  const existing = await backend.getTemplate(id)
  if (existing === undefined) return
  const record: TemplateRecord = {
    id,
    title,
    description,
    createdAt: existing.createdAt,
    updatedAt: Date.now(),
    ...deriveTemplateFields(doc),
  }
  await backend.putTemplate(record)
}

export const deleteTemplate = (id: string): Promise<void> =>
  getPersistenceBackend().deleteTemplate(id)
