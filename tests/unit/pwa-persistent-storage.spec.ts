import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isStoragePersistent,
  requestPersistentStorage,
  resetPersistentStorageRequest,
} from '@/pwa/persistentStorage'

const stubStorage = (impl: Partial<StorageManager>): void => {
  vi.stubGlobal('navigator', { storage: impl as StorageManager })
}

describe('persistent storage request', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    resetPersistentStorageRequest()
  })

  it('requests persist() exactly once (one-shot latch)', async () => {
    const persist = vi.fn(async () => true)
    stubStorage({ persist })
    await expect(requestPersistentStorage()).resolves.toBe(true)
    await expect(requestPersistentStorage()).resolves.toBe(false)
    expect(persist).toHaveBeenCalledTimes(1)
  })

  it('returns false when the API is unavailable or throws', async () => {
    stubStorage({})
    await expect(requestPersistentStorage()).resolves.toBe(false)

    resetPersistentStorageRequest()
    stubStorage({ persist: vi.fn(async () => { throw new Error('denied') }) })
    await expect(requestPersistentStorage()).resolves.toBe(false)
  })

  it('isStoragePersistent reflects the grant, null without the API', async () => {
    stubStorage({ persisted: vi.fn(async () => true) })
    await expect(isStoragePersistent()).resolves.toBe(true)

    stubStorage({ persisted: vi.fn(async () => false) })
    await expect(isStoragePersistent()).resolves.toBe(false)

    stubStorage({})
    await expect(isStoragePersistent()).resolves.toBeNull()
  })
})
