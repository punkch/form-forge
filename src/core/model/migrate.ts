/**
 * Persisted-document migrations. `FormDocument.schemaVersion` versions the
 * document payload independently of the DB schema and of any archive
 * container. Every document sourced from outside the running app (workspace
 * archives, future storage upgrades) passes through migrateDoc before use.
 *
 * Version 1 is the only schema so far, so this is a tolerant shape gate:
 * it verifies the top-level structure a v1 document must have without
 * re-validating every nested field (the form validators own that).
 */
import { error } from '../validate/issues'
import type { Issue } from '../validate/issues'
import type { FormDocument } from './types'

export const CURRENT_DOC_SCHEMA_VERSION = 1

export interface MigrateDocResult {
  doc: FormDocument | null
  issues: Issue[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const failure = (issue: Issue): MigrateDocResult => ({ doc: null, issues: [issue] })

/**
 * Shape-check every node in the tree: each must be an object carrying string
 * `id`/`name`/`kind`, and any group/repeat container must have an array of
 * children. Defends the loose `raw as FormDocument` cast below against crafted
 * or corrupted archives without re-validating field semantics.
 */
const nodesWellFormed = (nodes: unknown[]): boolean =>
  nodes.every((node) => {
    if (!isRecord(node)) return false
    if (typeof node.id !== 'string' || typeof node.name !== 'string' || typeof node.kind !== 'string') {
      return false
    }
    if (node.kind === 'group' || node.kind === 'repeat') {
      return Array.isArray(node.children) && nodesWellFormed(node.children)
    }
    return true
  })

export const migrateDoc = (raw: unknown): MigrateDocResult => {
  if (!isRecord(raw)) {
    return failure(error('doc.malformed', 'The form document is not a JSON object.'))
  }
  if (raw.schemaVersion !== CURRENT_DOC_SCHEMA_VERSION) {
    const found = typeof raw.schemaVersion === 'number' ? `schema version ${raw.schemaVersion}` : 'no schema version'
    return failure(error(
      'doc.schema-version-unsupported',
      `The form document has ${found}; this app supports version ${CURRENT_DOC_SCHEMA_VERSION}. ` +
      'It may have been created by a newer version of the app.'
    ))
  }
  const shapeOk = isRecord(raw.settings) &&
    Array.isArray(raw.languages) &&
    Array.isArray(raw.children) &&
    isRecord(raw.choiceLists) &&
    Array.isArray(raw.attachments)
  if (!shapeOk) {
    return failure(error('doc.malformed', 'The form document is missing required top-level fields.'))
  }
  if (!nodesWellFormed(raw.children as unknown[])) {
    return failure(error('doc.malformed', 'The form document contains a malformed node.'))
  }
  return { doc: raw as unknown as FormDocument, issues: [] }
}
