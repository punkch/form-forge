import Dexie, { type DexieOptions, type EntityTable } from 'dexie'

import type { FormDocument } from '@/core/model/types'

export interface FormRecord {
  /** Workspace-level record id (not the ODK form_id). */
  id: string
  title: string
  formId: string
  version: string
  questionCount: number
  createdAt: number
  updatedAt: number
  doc: FormDocument
}

export interface AttachmentRecord {
  /** Matches AttachmentRef.id in the form document. */
  id: string
  formRecordId: string
  filename: string
  mediatype: string
  size: number
  blob: Blob
}

export type SnapshotKind = 'auto' | 'manual' | 'import' | 'open'

export interface SnapshotRecord {
  id: string
  formRecordId: string
  createdAt: number
  kind: SnapshotKind
  doc: FormDocument
}

/** A locally saved "Save as template" form (per-browser, like forms). */
export interface TemplateRecord {
  id: string
  title: string
  description: string
  questionCount: number
  /** First few question labels — the gallery card's text preview. */
  preview: string[]
  createdAt: number
  updatedAt: number
  /** Stored without attachment refs — blobs never travel with templates. */
  doc: FormDocument
}

export class BuilderDb extends Dexie {
  forms!: EntityTable<FormRecord, 'id'>
  attachments!: EntityTable<AttachmentRecord, 'id'>
  snapshots!: EntityTable<SnapshotRecord, 'id'>
  templates!: EntityTable<TemplateRecord, 'id'>

  /** Options allow tests to inject an isolated IDBFactory (upgrade specs). */
  constructor (options?: DexieOptions) {
    // Pre-rebrand database name kept on purpose: renaming it would orphan
    // every existing user's saved forms (IndexedDB is origin-scoped).
    super('odk-form-builder', options)
    this.version(1).stores({
      forms: 'id, updatedAt, title',
      attachments: 'id, formRecordId',
      snapshots: 'id, formRecordId, createdAt',
    })
    // v2 adds local template storage; the v1 stores carry over unchanged.
    this.version(2).stores({
      templates: 'id, updatedAt, title',
    })
  }
}

export const db = new BuilderDb()
