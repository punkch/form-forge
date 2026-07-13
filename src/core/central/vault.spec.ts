import { beforeEach, describe, expect, it } from 'vitest'

import { vault } from './vault'

describe('vault', () => {
  // The derived key lives in a module-closure that persists across specs in the
  // same vitest worker; lock before each test so every case starts locked.
  beforeEach(() => {
    vault.lock()
  })

  it('starts locked', () => {
    expect(vault.isUnlocked()).toBe(false)
  })

  it('create installs the key and returns persistable meta', async () => {
    const meta = await vault.create('correct horse battery staple')
    expect(vault.isUnlocked()).toBe(true)
    expect(meta.salt).toBeInstanceOf(Uint8Array)
    expect(meta.salt.length).toBe(16)
    expect(meta.keyCheck.iv).toBeInstanceOf(Uint8Array)
    expect(meta.keyCheck.iv.length).toBe(12)
    expect(meta.keyCheck.ciphertext.length).toBeGreaterThan(0)
  })

  it('round-trips a plaintext secret through encrypt/decrypt', async () => {
    await vault.create('passphrase')
    const secret = 'super-secret-password'
    const blob = await vault.encrypt(secret)
    expect(blob.iv.length).toBe(12)
    // Ciphertext carries the AES-GCM auth tag, so it is longer than the
    // plaintext and never the plaintext bytes in the clear.
    expect(blob.ciphertext.length).toBeGreaterThan(secret.length)
    expect(await vault.decrypt(blob)).toBe(secret)
  })

  it('uses a fresh IV and ciphertext for each encryption', async () => {
    await vault.create('passphrase')
    const a = await vault.encrypt('x')
    const b = await vault.encrypt('x')
    expect(a.iv).not.toEqual(b.iv)
    expect(a.ciphertext).not.toEqual(b.ciphertext)
  })

  it('unlock with the correct passphrase returns true and enables decrypt', async () => {
    const meta = await vault.create('right')
    const blob = await vault.encrypt('secret')
    vault.lock()
    expect(vault.isUnlocked()).toBe(false)

    const ok = await vault.unlock('right', meta)
    expect(ok).toBe(true)
    expect(vault.isUnlocked()).toBe(true)
    expect(await vault.decrypt(blob)).toBe('secret')
  })

  it('unlock with a wrong passphrase returns false and leaves the vault locked', async () => {
    const meta = await vault.create('right')
    vault.lock()

    const ok = await vault.unlock('wrong', meta)
    expect(ok).toBe(false)
    expect(vault.isUnlocked()).toBe(false)
  })

  it('encrypt throws when the vault is locked', async () => {
    await expect(vault.encrypt('x')).rejects.toThrow()
  })

  it('decrypt throws when the vault is locked', async () => {
    await vault.create('p')
    const blob = await vault.encrypt('x')
    vault.lock()
    await expect(vault.decrypt(blob)).rejects.toThrow()
  })

  it('resetKey produces a distinct salt and a working new key', async () => {
    const first = await vault.create('old')
    const reset = await vault.resetKey('new')
    expect(reset.salt).not.toEqual(first.salt)
    expect(vault.isUnlocked()).toBe(true)

    const blob = await vault.encrypt('after-reset')
    expect(await vault.decrypt(blob)).toBe('after-reset')

    vault.lock()
    expect(await vault.unlock('new', reset)).toBe(true)
  })

  it('rejects the old passphrase against reset meta via the key-check', async () => {
    await vault.create('old')
    const reset = await vault.resetKey('new')
    vault.lock()
    expect(await vault.unlock('old', reset)).toBe(false)
  })
})
