/**
 * Central server + credential-vault storage, behind the persistence seam (so
 * embed mode's memory backend keeps identical behavior). This repo is
 * crypto-ignorant: it persists opaque `{iv,ciphertext}`/salt bytes exactly as
 * the vault (src/core/central/vault.ts) hands them over, and never sees a
 * plaintext password, session token, or key.
 */
import { newId } from '@/core/model/ids'

import { getPersistenceBackend } from './backend'
import type { CentralServerRecord, CentralVaultRecord } from './db'

/** A server to save; a missing `id` means "create" (a fresh id is minted). */
export type CentralServerInput = Omit<CentralServerRecord, 'id'> & { id?: string }

export const listCentralServers = (): Promise<CentralServerRecord[]> =>
  getPersistenceBackend().listCentralServers()

export const getCentralServer = (id: string): Promise<CentralServerRecord | undefined> =>
  getPersistenceBackend().getCentralServer(id)

/**
 * Create or update a server. With no `id` a fresh record is inserted; with an
 * `id` the existing record is replaced. Returns the stored record.
 */
export const saveCentralServer = async (server: CentralServerInput): Promise<CentralServerRecord> => {
  const backend = getPersistenceBackend()
  if (server.id !== undefined) {
    const record: CentralServerRecord = { ...server, id: server.id }
    await backend.putCentralServer(record)
    return record
  }
  const record: CentralServerRecord = { ...server, id: newId() }
  await backend.addCentralServer(record)
  return record
}

/** Delete a server and, atomically, every publish target that points at it. */
export const deleteCentralServer = (id: string): Promise<void> =>
  getPersistenceBackend().deleteCentralServer(id)

export const getVaultMeta = (): Promise<CentralVaultRecord | undefined> =>
  getPersistenceBackend().getVaultMeta()

export const setVaultMeta = (meta: CentralVaultRecord): Promise<void> =>
  getPersistenceBackend().putVaultMeta(meta)

/**
 * Forgotten-passphrase reset: install the new vault meta and, in the same
 * atomic op, wipe the encrypted password off every server row. Server records
 * survive; only their stored passwords are cleared.
 */
export const resetVaultWipingPasswords = (meta: CentralVaultRecord): Promise<void> =>
  getPersistenceBackend().resetVault(meta)
