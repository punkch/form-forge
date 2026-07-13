/**
 * Credential vault — passphrase-derived, non-extractable AES-GCM encryption of
 * per-server ODK Central passwords.
 *
 * Pure TypeScript using WebCrypto off `globalThis` (following the
 * `src/core/model/ids.ts` `globalThis.crypto.randomUUID()` convention: no
 * feature-detect, no new dependency — node and browsers both provide
 * `crypto.subtle`/`getRandomValues`). No Vue/Pinia/Dexie/vue-i18n imports.
 *
 * The vault does crypto only. The derived key never leaves this module (it
 * lives in the module-closure `currentKey`, is never returned, never persisted,
 * and never enters a ref/Pinia field where devtools would expose it). Only
 * opaque `{ iv, ciphertext }`/salt/key-check bytes cross the persistence
 * boundary; where those bytes are stored is `src/persistence`'s concern, not
 * this module's.
 */

/** AES-GCM ciphertext with the fresh IV used to produce it. Clone-safe bytes. */
export interface EncryptedBlob {
  iv: Uint8Array
  ciphertext: Uint8Array
}

/** Persisted vault metadata: the PBKDF2 salt and the unlock key-check blob. */
export interface VaultMeta {
  salt: Uint8Array
  keyCheck: EncryptedBlob
}

/** OWASP-current PBKDF2-SHA-256 iteration count (2023+). */
const PBKDF2_ITERATIONS = 600_000
/** PBKDF2 salt length in bytes. */
const SALT_BYTES = 16
/** AES-GCM IV length in bytes (96-bit, the GCM-recommended size). */
const IV_BYTES = 12
/**
 * Fixed constant encrypted at vault creation and decrypted at unlock. An
 * AES-GCM authentication failure when decrypting this proves the derived key
 * (hence the passphrase) is wrong, without ever touching a real stored secret.
 */
const KEY_CHECK_PLAINTEXT = 'form-forge:central-vault:key-check:v1'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/**
 * The derived AES-GCM key while the vault is unlocked. Module-closure only —
 * never returned, never persisted, never in a ref/Pinia field. Precedent:
 * `src/persistence/backend.ts` `let activeBackend`.
 */
let currentKey: CryptoKey | null = null

const randomBytes = (length: number): Uint8Array =>
  globalThis.crypto.getRandomValues(new Uint8Array(length))

/**
 * Normalise bytes to a fresh `ArrayBuffer`-backed view. WebCrypto's
 * `BufferSource` excludes `SharedArrayBuffer`-backed arrays, which is how a
 * bare `Uint8Array` is typed once `@types/node` is in scope; copying through
 * this at each `subtle.*` call boundary gives the API the exact shape it
 * accepts without narrowing the persisted `EncryptedBlob` byte shape.
 */
const asBufferSource = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => Uint8Array.from(bytes)

/** Derive a non-extractable AES-GCM key from a passphrase + salt via PBKDF2. */
async function deriveKey (passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return globalThis.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: asBufferSource(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/** Encrypt a string under a key with a fresh random IV. */
async function encryptWith (key: CryptoKey, plaintext: string): Promise<EncryptedBlob> {
  const iv = randomBytes(IV_BYTES)
  const ciphertext = new Uint8Array(
    await globalThis.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: asBufferSource(iv) },
      key,
      asBufferSource(encoder.encode(plaintext))
    )
  )
  return { iv, ciphertext }
}

/** Derive a key + fresh key-check for a new or reset vault, and install it. */
async function initVault (passphrase: string): Promise<VaultMeta> {
  const salt = randomBytes(SALT_BYTES)
  const key = await deriveKey(passphrase, salt)
  const keyCheck = await encryptWith(key, KEY_CHECK_PLAINTEXT)
  currentKey = key
  return { salt, keyCheck }
}

export const vault = {
  /** True while a derived key is installed (the vault is unlocked). */
  isUnlocked (): boolean {
    return currentKey !== null
  },

  /**
   * Create a brand-new vault: derive + install the key and return the meta
   * (salt + key-check) for the caller to persist.
   */
  async create (passphrase: string): Promise<VaultMeta> {
    return initVault(passphrase)
  },

  /**
   * Derive the key from `passphrase` + persisted `meta` and verify it against
   * the key-check. On success install the key and return `true`; on an AES-GCM
   * authentication failure (wrong passphrase) leave the vault untouched and
   * return `false` — no real stored secret is decrypted to make this decision.
   */
  async unlock (passphrase: string, meta: VaultMeta): Promise<boolean> {
    const key = await deriveKey(passphrase, meta.salt)
    try {
      await globalThis.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: asBufferSource(meta.keyCheck.iv) },
        key,
        asBufferSource(meta.keyCheck.ciphertext)
      )
    } catch {
      return false
    }
    currentKey = key
    return true
  },

  /** Drop the derived key. */
  lock (): void {
    currentKey = null
  },

  /** Encrypt a plaintext string. Throws if the vault is locked. */
  async encrypt (plaintext: string): Promise<EncryptedBlob> {
    const key = currentKey
    if (key === null) throw new Error('Vault is locked')
    return encryptWith(key, plaintext)
  },

  /** Decrypt a blob back to its plaintext string. Throws if the vault is locked. */
  async decrypt (blob: EncryptedBlob): Promise<string> {
    const key = currentKey
    if (key === null) throw new Error('Vault is locked')
    const plaintext = await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asBufferSource(blob.iv) },
      key,
      asBufferSource(blob.ciphertext)
    )
    return decoder.decode(plaintext)
  },

  /**
   * Forgotten-passphrase reset: derive + install a key from a new passphrase
   * with a fresh salt + key-check, returning the new meta to persist. The
   * caller (the repo) then wipes stored passwords, which can no longer be
   * decrypted. Change-passphrase (re-encrypt all secrets) is out of scope.
   */
  async resetKey (newPassphrase: string): Promise<VaultMeta> {
    return initVault(newPassphrase)
  },
}
