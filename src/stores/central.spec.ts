import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isProxy, reactive } from 'vue'

import { vault } from '@/core/central/vault'
import { db } from '@/persistence/db'

import { useCentralStore } from './central'

// Mock ONLY the fetch client (so no network); the vault (real WebCrypto) and
// the persistence repos (real, via fake-indexeddb) stay live. Importing the
// client and the vault from separate module paths is what lets us mock one and
// keep the other real.
const clientMocks = vi.hoisted(() => {
  const createSession = vi.fn(async (email: string, _password: string) => ({ token: `tok-${email}` }))
  const deleteSession = vi.fn(async (_token: string) => {})
  const listProjects = vi.fn(async (_token: string) => [{ id: 1, name: 'Proj', verbs: ['form.create'] }])
  const listForms = vi.fn(async (_token: string, _projectId: number) => [
    { xmlFormId: 'f1', name: 'Form 1', publishedAt: '2026-01-01T00:00:00Z' },
  ])
  const client = { createSession, deleteSession, listProjects, listForms }
  return { ...client, createCentralClient: vi.fn(() => client) }
})

vi.mock('@/core/central/client', () => ({
  createCentralClient: clientMocks.createCentralClient,
}))

const PASSPHRASE = 'correct horse'

type Store = ReturnType<typeof useCentralStore>

/** Unlock a fresh vault and register a server with a saved password. */
const seedUnlockedServer = async (store: Store, password = 'super-secret'): Promise<string> => {
  await store.submitCreate(PASSPHRASE)
  const record = await store.saveServer({ name: 'Field Central', baseUrl: 'https://central.example.org', email: 'me@example.org' })
  await store.saveServerPassword(record.id, password)
  return record.id
}

beforeEach(async () => {
  setActivePinia(createPinia())
  vault.lock() // module-closure key persists across specs in one worker.
  vi.clearAllMocks()
  await Promise.all([
    db.centralServers.clear(),
    db.centralVault.clear(),
    db.publishTargets.clear(),
  ])
})

afterEach(() => {
  useCentralStore().stopWatching()
})

describe('central store — unlock gate', () => {
  it('ensureUnlocked resolves immediately when the vault is already unlocked', async () => {
    const store = useCentralStore()
    await store.submitCreate(PASSPHRASE)
    expect(store.isUnlocked).toBe(true)

    await expect(store.ensureUnlocked()).resolves.toBeUndefined()
    expect(store.unlockPromptOpen).toBe(false)
  })

  it('ensureUnlocked opens the dialog in create mode when no vault exists, and submitCreate resolves it', async () => {
    const store = useCentralStore()
    const gate = store.ensureUnlocked()

    await vi.waitFor(() => expect(store.unlockPromptOpen).toBe(true))
    expect(store.unlockMode).toBe('create')

    await store.submitCreate(PASSPHRASE)
    await expect(gate).resolves.toBeUndefined()
    expect(store.unlockPromptOpen).toBe(false)
    expect(store.isUnlocked).toBe(true)
  })

  it('ensureUnlocked opens in unlock mode when a vault already exists', async () => {
    const store = useCentralStore()
    await store.submitCreate(PASSPHRASE)
    store.lockVault()
    expect(store.isUnlocked).toBe(false)

    void store.ensureUnlocked()
    await vi.waitFor(() => expect(store.unlockPromptOpen).toBe(true))
    expect(store.unlockMode).toBe('unlock')
  })

  it('submitUnlock rejects a wrong passphrase (stays locked) and accepts the right one', async () => {
    const store = useCentralStore()
    await store.submitCreate(PASSPHRASE)
    store.lockVault()

    await expect(store.submitUnlock('nope')).resolves.toBe(false)
    expect(store.isUnlocked).toBe(false)

    await expect(store.submitUnlock(PASSPHRASE)).resolves.toBe(true)
    expect(store.isUnlocked).toBe(true)
  })

  it('cancelUnlock rejects the parked ensureUnlocked promise', async () => {
    const store = useCentralStore()
    const gate = store.ensureUnlocked()
    await vi.waitFor(() => expect(store.unlockPromptOpen).toBe(true))

    store.cancelUnlock()
    await expect(gate).rejects.toThrow()
    expect(store.unlockPromptOpen).toBe(false)
  })

  it('fans a single submitCreate out to every parked ensureUnlocked waiter', async () => {
    const store = useCentralStore()
    const gateA = store.ensureUnlocked()
    const gateB = store.ensureUnlocked()
    await vi.waitFor(() => expect(store.unlockPromptOpen).toBe(true))
    expect(store.unlockMode).toBe('create')

    await store.submitCreate(PASSPHRASE)

    // Both waiters resolve off the one create, and the dialog closes once.
    await expect(Promise.all([gateA, gateB])).resolves.toEqual([undefined, undefined])
    expect(store.isUnlocked).toBe(true)
    expect(store.unlockPromptOpen).toBe(false)
  })

  it('rejects every parked ensureUnlocked waiter on a single cancelUnlock', async () => {
    const store = useCentralStore()
    const gateA = store.ensureUnlocked()
    const gateB = store.ensureUnlocked()
    await vi.waitFor(() => expect(store.unlockPromptOpen).toBe(true))

    store.cancelUnlock()

    await expect(gateA).rejects.toThrow()
    await expect(gateB).rejects.toThrow()
    expect(store.unlockPromptOpen).toBe(false)
  })
})

describe('central store — sessions', () => {
  it('connect decrypts the password, exchanges a token and marks the server connected', async () => {
    const store = useCentralStore()
    const id = await seedUnlockedServer(store)

    await store.connect(id)

    expect(clientMocks.createSession).toHaveBeenCalledTimes(1)
    expect(clientMocks.createSession).toHaveBeenCalledWith('me@example.org', 'super-secret')
    expect(store.isConnected(id)).toBe(true)
    expect(store.connectionState(id)).toEqual({ status: 'connected', email: 'me@example.org' })
  })

  it('reuses the cached token for subsequent reads (no second session)', async () => {
    const store = useCentralStore()
    const id = await seedUnlockedServer(store)
    await store.connect(id)

    const projects = await store.listProjects(id)
    expect(projects).toHaveLength(1)
    // listProjects reused the stashed token — createSession not called again.
    expect(clientMocks.createSession).toHaveBeenCalledTimes(1)
    expect(clientMocks.listProjects).toHaveBeenCalledWith('tok-me@example.org')
  })

  it('connect throws when the server has no saved credentials', async () => {
    const store = useCentralStore()
    await store.submitCreate(PASSPHRASE)
    const record = await store.saveServer({ name: 'No creds', baseUrl: 'https://x.example.org' })

    await expect(store.connect(record.id)).rejects.toThrow()
    expect(store.isConnected(record.id)).toBe(false)
  })

  it('shares one session POST across concurrent first actions (no double connect)', async () => {
    const store = useCentralStore()
    const id = await seedUnlockedServer(store)

    // Two authenticated actions fire before any token is cached. They must share
    // a single createSession — otherwise the second POST orphans the first
    // token server-side.
    await Promise.all([store.listProjects(id), store.listForms(id, 1)])

    expect(clientMocks.createSession).toHaveBeenCalledTimes(1)
    expect(store.isConnected(id)).toBe(true)
  })

  it('rejects an empty session token instead of reporting connected', async () => {
    const store = useCentralStore()
    const id = await seedUnlockedServer(store)
    // A malformed 200 body whose token coerced to '' must fail as an auth error,
    // not leave us "connected" and sending `Authorization: Bearer `.
    clientMocks.createSession.mockResolvedValueOnce({ token: '' })

    await expect(store.connect(id)).rejects.toThrow()
    expect(store.isConnected(id)).toBe(false)
    expect(store.connectionState(id).status).toBe('error')
  })

  it('disconnect wipes the token and connection state and ends the session server-side', async () => {
    const store = useCentralStore()
    const id = await seedUnlockedServer(store)
    await store.connect(id)

    await store.disconnect(id)

    expect(clientMocks.deleteSession).toHaveBeenCalledWith('tok-me@example.org')
    expect(store.isConnected(id)).toBe(false)
    expect(store.connectionState(id).status).toBe('disconnected')

    // The token is gone: the next read must open a fresh session.
    await store.listProjects(id)
    expect(clientMocks.createSession).toHaveBeenCalledTimes(2)
  })

  it('disconnect on a never-connected server is a no-op (no deleteSession)', async () => {
    const store = useCentralStore()
    await store.submitCreate(PASSPHRASE)
    const record = await store.saveServer({ name: 'Idle', baseUrl: 'https://idle.example.org' })

    await store.disconnect(record.id)

    expect(clientMocks.deleteSession).not.toHaveBeenCalled()
    expect(store.isConnected(record.id)).toBe(false)
  })

  it('lockVault drops the key, every token and all connection state', async () => {
    const store = useCentralStore()
    const id = await seedUnlockedServer(store)
    await store.connect(id)
    expect(clientMocks.createSession).toHaveBeenCalledTimes(1)

    store.lockVault()

    expect(store.isUnlocked).toBe(false)
    expect(store.isConnected(id)).toBe(false)

    // Re-unlock and read again: because the token map was cleared, a brand-new
    // session is required — proving lockVault wiped the tokens.
    await expect(store.submitUnlock(PASSPHRASE)).resolves.toBe(true)
    await store.listProjects(id)
    expect(clientMocks.createSession).toHaveBeenCalledTimes(2)
  })
})

describe('central store — servers, credentials and targets', () => {
  it('hasServers reflects the repo via liveQuery', async () => {
    const store = useCentralStore()
    expect(store.hasServers).toBe(false)

    await store.saveServer({ name: 'Central', baseUrl: 'https://central.example.org' })
    await vi.waitFor(() => expect(store.hasServers).toBe(true))
    expect(store.servers.map((s) => s.name)).toContain('Central')
  })

  it('saveServerPassword encrypts before persisting (no plaintext at rest)', async () => {
    const store = useCentralStore()
    await store.submitCreate(PASSPHRASE)
    const record = await store.saveServer({ name: 'Central', baseUrl: 'https://central.example.org', email: 'me@example.org' })

    await store.saveServerPassword(record.id, 'plaintext-pw')

    const stored = await store.getCentralServer(record.id)
    const blob = stored?.encryptedPassword
    expect(blob).toBeDefined()
    // The persisted ciphertext is not the plaintext bytes…
    expect(new TextDecoder().decode(blob!.ciphertext)).not.toBe('plaintext-pw')
    expect([...blob!.ciphertext]).not.toEqual([...new TextEncoder().encode('plaintext-pw')])
    // …but the vault can round-trip it back to the original.
    await expect(vault.decrypt(blob!)).resolves.toBe('plaintext-pw')
  })

  it('saveServer strips Vue reactivity so the record survives a real structured clone', async () => {
    // Regression: the servers section spreads a (reactive) store record back
    // into saveServer; a proxied nested encryptedPassword made Dexie's put
    // throw DataCloneError in the browser (fake-indexeddb's lenient clone
    // never caught it, so assert with Node's real structuredClone).
    const store = useCentralStore()
    const id = await seedUnlockedServer(store)
    const proxied = reactive((await store.getCentralServer(id))!)

    const saved = await store.saveServer({ ...proxied, name: 'Renamed' })

    expect(isProxy(saved.encryptedPassword)).toBe(false)
    expect(() => structuredClone(saved)).not.toThrow()
    expect((await store.getCentralServer(id))?.name).toBe('Renamed')
  })

  it('resetVault wipes stored passwords, keeps the server records and unlocks', async () => {
    const store = useCentralStore()
    const id = await seedUnlockedServer(store)
    expect((await store.getCentralServer(id))?.encryptedPassword).toBeDefined()

    await store.resetVault('a-new-passphrase')

    const survivor = await store.getCentralServer(id)
    expect(survivor).toBeDefined()
    expect(survivor?.encryptedPassword).toBeUndefined()
    expect(store.isUnlocked).toBe(true)
  })

  it('deleteCentralServer removes the record and drops any live connection', async () => {
    const store = useCentralStore()
    const id = await seedUnlockedServer(store)
    await store.connect(id)
    expect(store.isConnected(id)).toBe(true)

    await store.deleteCentralServer(id)

    expect(await store.getCentralServer(id)).toBeUndefined()
    expect(store.isConnected(id)).toBe(false)
  })

  it('deleteCentralServer ends a live session server-side before dropping the record', async () => {
    const store = useCentralStore()
    const id = await seedUnlockedServer(store)
    await store.connect(id)

    await store.deleteCentralServer(id)

    expect(clientMocks.deleteSession).toHaveBeenCalledWith('tok-me@example.org')
    expect(await store.getCentralServer(id)).toBeUndefined()
  })

  it('deleteCentralServer on a never-connected server does not call deleteSession', async () => {
    const store = useCentralStore()
    await store.submitCreate(PASSPHRASE)
    const record = await store.saveServer({ name: 'Idle', baseUrl: 'https://idle.example.org' })

    await store.deleteCentralServer(record.id)

    expect(clientMocks.deleteSession).not.toHaveBeenCalled()
    expect(await store.getCentralServer(record.id)).toBeUndefined()
  })

  it('listForms fetches via the connected client', async () => {
    const store = useCentralStore()
    const id = await seedUnlockedServer(store)

    const forms = await store.listForms(id, 1)
    expect(forms).toHaveLength(1)
    expect(clientMocks.listForms).toHaveBeenCalledWith('tok-me@example.org', 1)
  })

  it('upsertTarget and listTargetsForForm round-trip a publish target', async () => {
    const store = useCentralStore()
    const saved = await store.upsertTarget({
      formRecordId: 'form-1',
      serverId: 'srv-1',
      projectId: 1,
      xmlFormId: 'my-form',
      lastPublishedVersion: '202607131200',
      lastPublishedAt: Date.now(),
    })
    expect(saved.id).toBeDefined()

    const targets = await store.listTargetsForForm('form-1')
    expect(targets.map((t) => t.xmlFormId)).toEqual(['my-form'])
  })
})
