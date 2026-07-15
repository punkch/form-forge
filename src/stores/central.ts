/**
 * ODK Central integration store — the reactive surface every Central UI package
 * consumes, plus the cross-route unlock-dialog gate and the session/connection
 * lifecycle.
 *
 * Security boundary (see the plan's cross-cutting rules):
 * - Session tokens live in a NON-reactive closure `Map` (never a ref/Pinia
 *   field, which devtools would expose). Only connection *status* is reactive.
 * - The derived vault key never touches this store — it lives in the
 *   `vault.ts` module closure; this store only calls `vault.*`.
 * - No plaintext secret is persisted: passwords are encrypted via `vault.encrypt`
 *   before they reach the repo, and only exist transiently during `connect`.
 *
 * A setup-store (mirrors `src/stores/workspace.ts`): the server list is a
 * `liveQuery` subscription held in a closure `let subscription`, auto-started so
 * `hasServers` gates UI app-wide (the editor Publish button and the import
 * "From Central" source live on always-present routes).
 */
import { liveQuery, type Subscription } from 'dexie'
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toRaw } from 'vue'

import { createCentralClient, type CentralClient } from '@/core/central/client'
import {
  importFormFromCentral as runImportFromCentral,
  type CentralImportResult,
} from '@/core/central/import'
import {
  publishForm as runPublishForm,
  type CentralPublishResult,
  type PublishInput,
} from '@/core/central/publish'
import {
  CentralError,
  type CentralFormSummary,
  type CentralProject,
} from '@/core/central/types'
import { vault } from '@/core/central/vault'
import * as centralServersRepo from '@/persistence/central-servers-repo'
import type { CentralServerInput } from '@/persistence/central-servers-repo'
import * as publishTargetsRepo from '@/persistence/publish-targets-repo'
import type { PublishTargetInput } from '@/persistence/publish-targets-repo'
import type { CentralServerRecord, PublishTargetRecord } from '@/persistence/db'

/** Per-server connection state (the reactive half; the token stays private). */
export interface CentralConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  email?: string
}

/** Which face the shared UnlockVaultDialog wears when it opens. */
export type UnlockMode = 'create' | 'unlock'

const DISCONNECTED: CentralConnectionState = { status: 'disconnected' }

export const useCentralStore = defineStore('central', () => {
  // --- Reactive state -------------------------------------------------------
  /** Immutable snapshots replaced wholesale by liveQuery — shallow so records
   * stay raw (deep proxies would fail IndexedDB's structured clone if spread
   * back into a save). */
  const servers = shallowRef<CentralServerRecord[]>([])
  const loading = ref(true)
  /** Reactive per-server connection status (never the token itself). */
  const connections = ref<Map<string, CentralConnectionState>>(new Map())
  const unlockPromptOpen = ref(false)
  const unlockMode = ref<UnlockMode>('unlock')
  /** Bumped on every vault lock-state change so `isUnlocked` re-evaluates. */
  const unlockVersion = ref(0)

  // --- Non-reactive closures (never devtools-visible) -----------------------
  /** Session bearer tokens, keyed by server id. Deliberately not reactive. */
  let tokens = new Map<string, string>()
  /**
   * In-flight `openSession` promises, keyed by server id, so concurrent
   * first-actions against one server share a SINGLE session POST. Without this
   * two racers both see no cached token, both POST /v1/sessions, and the second
   * `tokens.set` orphans the first token server-side. Entries clear on settle.
   */
  let connectsInFlight = new Map<string, Promise<string>>()
  /** Awaiters parked by `ensureUnlocked` until the dialog resolves/rejects. */
  let unlockWaiters: Array<{ resolve: () => void, reject: (reason?: unknown) => void }> = []
  let subscription: Subscription | null = null

  // --- Derived --------------------------------------------------------------
  const isUnlocked = computed((): boolean => {
    // Touch the tick so this recomputes on lock/unlock/create/reset.
    void unlockVersion.value
    return vault.isUnlocked()
  })
  const hasServers = computed((): boolean => servers.value.length > 0)

  // --- liveQuery subscription (mirrors workspace.ts) ------------------------
  const startWatching = (): void => {
    if (subscription !== null) return
    subscription = liveQuery(centralServersRepo.listCentralServers).subscribe({
      next: (records) => {
        servers.value = records
        loading.value = false
      },
      error: (error) => {
        console.error('Failed to read Central servers from IndexedDB', error)
        loading.value = false
      },
    })
  }

  const stopWatching = (): void => {
    subscription?.unsubscribe()
    subscription = null
  }

  // --- Connection-state helpers ---------------------------------------------
  const setConnection = (serverId: string, state: CentralConnectionState): void => {
    connections.value.set(serverId, state)
  }
  const connectionState = (serverId: string): CentralConnectionState =>
    connections.value.get(serverId) ?? DISCONNECTED
  const isConnected = (serverId: string): boolean =>
    connectionState(serverId).status === 'connected'
  const clearAllConnections = (): void => { connections.value.clear() }

  // --- Unlock-waiter helpers ------------------------------------------------
  const resolveWaiters = (): void => {
    const waiters = unlockWaiters
    unlockWaiters = []
    for (const { resolve } of waiters) resolve()
  }
  const rejectWaiters = (reason: unknown): void => {
    const waiters = unlockWaiters
    unlockWaiters = []
    for (const { reject } of waiters) reject(reason)
  }

  // --- Promise-gated unlock -------------------------------------------------
  /**
   * Resolve immediately if the vault is unlocked; otherwise open the shared
   * UnlockVaultDialog (create vs unlock decided by whether vault meta exists)
   * and park until the dialog calls `submitCreate`/`submitUnlock` (resolve) or
   * `cancelUnlock` (reject). The first Central action of a session awaits this.
   */
  const ensureUnlocked = async (): Promise<void> => {
    if (vault.isUnlocked()) return
    const meta = await centralServersRepo.getVaultMeta()
    unlockMode.value = meta === undefined ? 'create' : 'unlock'
    unlockPromptOpen.value = true
    return await new Promise<void>((resolve, reject) => {
      unlockWaiters.push({ resolve, reject })
    })
  }

  /**
   * Whether a vault has ever been created (meta row exists). Lets an inline
   * unlock surface (the Central drawer) pick its create-vs-unlock face WITHOUT
   * opening the app-global `UnlockVaultDialog` — so it can resolve unlock once,
   * up front, and never stack a modal over a flow.
   */
  const hasVaultMeta = async (): Promise<boolean> =>
    (await centralServersRepo.getVaultMeta()) !== undefined

  /** Dialog callback (create mode): install a brand-new vault and persist meta. */
  const submitCreate = async (passphrase: string): Promise<void> => {
    const meta = await vault.create(passphrase)
    await centralServersRepo.setVaultMeta({ id: 'vault', salt: meta.salt, keyCheck: meta.keyCheck })
    unlockVersion.value++
    // Resolve BEFORE closing so a user-close event can't reject the waiters.
    resolveWaiters()
    unlockPromptOpen.value = false
  }

  /**
   * Dialog callback (unlock mode): verify the passphrase against the key-check.
   * Returns `false` on a wrong passphrase WITHOUT closing (the dialog surfaces
   * `central.vault.wrongPassphrase`); no real stored secret is decrypted to
   * make the decision.
   */
  const submitUnlock = async (passphrase: string): Promise<boolean> => {
    const meta = await centralServersRepo.getVaultMeta()
    if (meta === undefined) return false
    const ok = await vault.unlock(passphrase, { salt: meta.salt, keyCheck: meta.keyCheck })
    if (!ok) return false
    unlockVersion.value++
    resolveWaiters()
    unlockPromptOpen.value = false
    return true
  }

  /** Dialog callback: user dismissed the unlock prompt. */
  const cancelUnlock = (): void => {
    unlockPromptOpen.value = false
    rejectWaiters(new CentralError('Vault unlock cancelled.', { kind: 'auth' }))
  }

  /**
   * Forgotten-passphrase reset: install a fresh key and wipe every stored
   * password (server rows survive). The vault ends unlocked, so any parked
   * unlock awaiter proceeds. Existing sessions are dropped — their passwords
   * can no longer be decrypted.
   */
  const resetVault = async (newPassphrase: string): Promise<void> => {
    const meta = await vault.resetKey(newPassphrase)
    await centralServersRepo.resetVaultWipingPasswords({ id: 'vault', salt: meta.salt, keyCheck: meta.keyCheck })
    tokens = new Map()
    connectsInFlight = new Map()
    clearAllConnections()
    unlockVersion.value++
    resolveWaiters()
    unlockPromptOpen.value = false
  }

  // --- Central client per server -------------------------------------------
  const clientFor = (baseUrl: string): CentralClient => createCentralClient({ baseUrl })

  const requireServer = async (serverId: string): Promise<CentralServerRecord> => {
    const server = await centralServersRepo.getCentralServer(serverId)
    if (server === undefined) throw new CentralError(`Unknown Central server ${serverId}.`, { kind: 'not-found' })
    return server
  }

  /**
   * Exchange a server's stored password for a fresh session token (kept in the
   * private closure) and mark the connection "connected". Takes an already
   * loaded record so callers never re-read it. The empty-token guard rejects a
   * malformed 200 body whose token coerced to `''` — otherwise we would report
   * "connected" and then send `Authorization: Bearer ` on every later call.
   */
  const openSession = async (server: CentralServerRecord): Promise<string> => {
    if (server.email === undefined || server.encryptedPassword === undefined) {
      throw new CentralError('This server has no saved email and password yet.', { kind: 'auth' })
    }
    setConnection(server.id, { status: 'connecting', email: server.email })
    try {
      const password = await vault.decrypt(server.encryptedPassword)
      const session = await clientFor(server.baseUrl).createSession(server.email, password)
      if (session.token.trim() === '') {
        throw new CentralError('Central returned an empty session token.', { kind: 'auth' })
      }
      tokens.set(server.id, session.token)
      setConnection(server.id, { status: 'connected', email: server.email })
      return session.token
    } catch (error) {
      setConnection(server.id, { status: 'error', email: server.email })
      throw error
    }
  }

  /**
   * Ensure a live session token for an already-loaded server record: return the
   * cached token, else open a session — sharing one in-flight `openSession`
   * across concurrent first-actions so a racing pair can never orphan a token.
   */
  const ensureToken = async (server: CentralServerRecord): Promise<string> => {
    const cached = tokens.get(server.id)
    if (cached !== undefined) return cached
    await ensureUnlocked()
    // A concurrent caller may have populated the token while we awaited unlock.
    const afterUnlock = tokens.get(server.id)
    if (afterUnlock !== undefined) return afterUnlock
    const inFlight = connectsInFlight.get(server.id)
    if (inFlight !== undefined) return inFlight
    const attempt = openSession(server)
    connectsInFlight.set(server.id, attempt)
    try {
      return await attempt
    } finally {
      connectsInFlight.delete(server.id)
    }
  }

  /**
   * Sign in to a server (reads the record once, then ensures a token). Awaits
   * `ensureUnlocked` via `ensureToken`, so this is a valid first-action entry.
   */
  const connect = async (serverId: string): Promise<void> => {
    const server = await requireServer(serverId)
    await ensureToken(server)
  }

  /**
   * Load a server record ONCE, ensure a session token for it, and hand back a
   * ready-to-use client bound to that server. The token stays inside the store
   * — every authenticated action funnels through here rather than repeating the
   * requireServer → ensure-token → clientFor dance (and re-reading the record).
   */
  const authedContext = async (serverId: string): Promise<{ client: CentralClient, token: string }> => {
    const server = await requireServer(serverId)
    const token = await ensureToken(server)
    return { client: clientFor(server.baseUrl), token }
  }

  /** Sign out: wipe the token + connection state, then best-effort invalidate
   * the session server-side (a network failure here still leaves us signed out). */
  const disconnect = async (serverId: string): Promise<void> => {
    const token = tokens.get(serverId)
    const server = await centralServersRepo.getCentralServer(serverId)
    tokens.delete(serverId)
    setConnection(serverId, DISCONNECTED)
    if (token !== undefined && server !== undefined) {
      try {
        await clientFor(server.baseUrl).deleteSession(token)
      } catch {
        // Best effort — the local session is already gone.
      }
    }
  }

  /** Lock the vault: drop the derived key, every token, and all connection state. */
  const lockVault = (): void => {
    vault.lock()
    tokens = new Map()
    connectsInFlight = new Map()
    clearAllConnections()
    unlockVersion.value++
  }

  // --- Picker data (user-initiated network reads) ---------------------------
  const listProjects = async (serverId: string): Promise<CentralProject[]> => {
    const { client, token } = await authedContext(serverId)
    return client.listProjects(token)
  }

  const listForms = async (serverId: string, projectId: number): Promise<CentralFormSummary[]> => {
    const { client, token } = await authedContext(serverId)
    return client.listForms(token, projectId)
  }

  // --- Authenticated orchestration (token stays private) --------------------
  // The pure core runners (`@/core/central/import` + `/publish`) are injected a
  // client + token; the store is the ONLY place that can supply a token, so it
  // owns these two entry points. Components never see a token — they call these.

  /**
   * Pull a published form (definition + attachments) from a server. Connects
   * (and unlocks) as needed, then runs the pure import assembly with a
   * server-bound client. The caller lands the returned document + blobs.
   */
  const importFormFromCentral = async (
    serverId: string,
    projectId: number,
    xmlFormId: string
  ): Promise<CentralImportResult> => {
    const { client, token } = await authedContext(serverId)
    return runImportFromCentral({ client, token, projectId, xmlFormId })
  }

  /**
   * Publish (create or update) a form draft to a server. Connects (and unlocks)
   * as needed, then runs the pure publish sequence with a server-bound client.
   * A version conflict surfaces as `CentralError{kind:'conflict'}` for the
   * caller's bump-and-retry.
   */
  const publishForm = async (
    serverId: string,
    projectId: number,
    input: Omit<PublishInput, 'client' | 'token' | 'projectId'>
  ): Promise<CentralPublishResult> => {
    const { client, token } = await authedContext(serverId)
    return runPublishForm({ ...input, client, token, projectId })
  }

  // --- Server CRUD + password save ------------------------------------------
  const getCentralServer = (id: string): Promise<CentralServerRecord | undefined> =>
    centralServersRepo.getCentralServer(id)

  /** Create or update a server's name/URL/email (credentials via saveServerPassword).
   * Unwraps Vue reactivity before the record crosses into IndexedDB — the
   * structured-clone algorithm rejects Proxies (DataCloneError). */
  const saveServer = (input: CentralServerInput): Promise<CentralServerRecord> => {
    const plain = { ...toRaw(input) }
    if (plain.encryptedPassword !== undefined) plain.encryptedPassword = toRaw(plain.encryptedPassword)
    return centralServersRepo.saveCentralServer(plain)
  }

  /**
   * Encrypt a plaintext password with the (unlocked) vault key and persist the
   * opaque `{iv,ciphertext}` bytes onto the server row. Prompts for unlock
   * first. The plaintext never leaves this call.
   */
  const saveServerPassword = async (serverId: string, password: string): Promise<void> => {
    await ensureUnlocked()
    const server = await requireServer(serverId)
    const encryptedPassword = await vault.encrypt(password)
    await centralServersRepo.saveCentralServer({ ...server, id: server.id, encryptedPassword })
  }

  /**
   * Delete a server (repo cascades its publish targets). Ends any live session
   * server-side first (best effort, via `disconnect`) so a token is not left
   * valid on Central after its local record is gone, then drops the connection
   * entry entirely.
   */
  const deleteCentralServer = async (id: string): Promise<void> => {
    await disconnect(id)
    connections.value.delete(id)
    await centralServersRepo.deleteCentralServer(id)
  }

  // --- Publish-target accessors ---------------------------------------------
  const listTargetsForForm = (formRecordId: string): Promise<PublishTargetRecord[]> =>
    publishTargetsRepo.listTargetsForForm(formRecordId)

  const upsertTarget = (input: PublishTargetInput): Promise<PublishTargetRecord> =>
    publishTargetsRepo.upsertTarget(input)

  // Auto-start so `hasServers` is live wherever the store is used (App-global).
  startWatching()

  return {
    // reactive state
    servers,
    loading,
    connections,
    unlockPromptOpen,
    unlockMode,
    // derived
    isUnlocked,
    hasServers,
    // liveQuery lifecycle
    startWatching,
    stopWatching,
    // connection introspection
    connectionState,
    isConnected,
    // unlock gate + dialog callbacks
    ensureUnlocked,
    hasVaultMeta,
    submitCreate,
    submitUnlock,
    cancelUnlock,
    resetVault,
    // session lifecycle
    connect,
    disconnect,
    lockVault,
    // picker data
    listProjects,
    listForms,
    // authenticated orchestration
    importFormFromCentral,
    publishForm,
    // server CRUD + credentials
    getCentralServer,
    saveServer,
    saveServerPassword,
    deleteCentralServer,
    // publish targets
    listTargetsForForm,
    upsertTarget,
  }
})
