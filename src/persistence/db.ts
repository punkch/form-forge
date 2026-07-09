import Dexie, { type EntityTable } from 'dexie'

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

export class BuilderDb extends Dexie {
  forms!: EntityTable<FormRecord, 'id'>
  attachments!: EntityTable<AttachmentRecord, 'id'>
  snapshots!: EntityTable<SnapshotRecord, 'id'>

  constructor () {
    super('odk-form-builder')
    this.version(1).stores({
      forms: 'id, updatedAt, title',
      attachments: 'id, formRecordId',
      snapshots: 'id, formRecordId, createdAt',
    })
  }
}

export const db = new BuilderDb()
