import { dexieBackend, setPersistenceBackend } from '@/persistence/backend'
import { db } from '@/persistence/db'
import { createMemoryBackend } from '@/persistence/memory-backend'

export interface BackendCase {
  name: string
  setup: () => Promise<void>
}

/**
 * Contract cases for persistence specs: every repo-level spec runs once per
 * backend (describe.each) so the Dexie default and embed mode's memory
 * backend keep identical observable behavior. `setup` installs the backend
 * and guarantees empty storage; call it from a beforeEach.
 */
export const backendCases: BackendCase[] = [
  {
    name: 'dexie',
    setup: async () => {
      setPersistenceBackend(dexieBackend)
      await Promise.all([
        db.forms.clear(),
        db.attachments.clear(),
        db.snapshots.clear(),
        db.centralServers.clear(),
        db.centralVault.clear(),
        db.publishTargets.clear(),
      ])
    },
  },
  {
    name: 'memory',
    setup: async () => {
      setPersistenceBackend(createMemoryBackend())
    },
  },
]
