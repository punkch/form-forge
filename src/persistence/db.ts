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

/**
 * Opaque AES-GCM ciphertext for a Central credential: a fresh 12-byte IV plus
 * the encrypted bytes. Persistence stays crypto-ignorant — it stores these
 * bytes verbatim and never sees a plaintext password, session token, or key.
 * The shape is owned by the crypto layer (`src/core/central/vault.ts`) and
 * re-exported here so persistence records can reference it without other
 * modules reaching across into core.
 */
export type { EncryptedBlob } from '@/core/central/vault'
import type { EncryptedBlob } from '@/core/central/vault'

/**
 * A registered ODK Central server. The stored password is opaque encrypted
 * bytes; there is never a plaintext password, session token, or CryptoKey on
 * this record. `encryptedPassword` is absent until the user saves one (and is
 * wiped, keeping the row, on a forgotten-passphrase vault reset).
 */
export interface CentralServerRecord {
  /** Workspace-level record id (not a Central identifier). */
  id: string
  name: string
  baseUrl: string
  email?: string
  encryptedPassword?: EncryptedBlob
}

/**
 * The single global credential-vault meta row (fixed id `'vault'`). One
 * passphrase covers every server, and the vault can exist before any server is
 * registered, so it lives in its own row rather than denormalized onto server
 * records. Holds only the PBKDF2 salt and a key-check blob — decrypting the
 * key-check validates a passphrase without touching any real secret.
 */
export interface CentralVaultRecord {
  id: 'vault'
  salt: Uint8Array
  keyCheck: EncryptedBlob
}

/**
 * A remembered publish destination for one workspace form: which Central
 * server/project the form was last published to (or imported from), for
 * one-click re-deploy and origin pre-fill. Carries no credential material.
 */
export interface PublishTargetRecord {
  /** Workspace-level record id. */
  id: string
  /** The FormRecord.id this target belongs to. */
  formRecordId: string
  /** The CentralServerRecord.id this target points at. */
  serverId: string
  /** ODK Central numeric project id. */
  projectId: number
  /** The Central xmlFormId (form definition id) on that project. */
  xmlFormId: string
  lastPublishedVersion: string
  lastPublishedAt: number
}

export class BuilderDb extends Dexie {
  forms!: EntityTable<FormRecord, 'id'>
  attachments!: EntityTable<AttachmentRecord, 'id'>
  snapshots!: EntityTable<SnapshotRecord, 'id'>
  templates!: EntityTable<TemplateRecord, 'id'>
  centralServers!: EntityTable<CentralServerRecord, 'id'>
  centralVault!: EntityTable<CentralVaultRecord, 'id'>
  publishTargets!: EntityTable<PublishTargetRecord, 'id'>

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
    // v3 adds Central integration tables (servers, the single credential-vault
    // meta row, and remembered publish targets); prior stores carry over
    // unchanged. publishTargets indexes formRecordId (a form's targets) and
    // serverId (cascade on server delete).
    this.version(3).stores({
      centralServers: 'id',
      centralVault: 'id',
      publishTargets: 'id, formRecordId, serverId',
    })
  }
}

export const db = new BuilderDb()
