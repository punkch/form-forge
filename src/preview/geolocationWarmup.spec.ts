import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const GEO_XML = '<bind nodeset="/data/loc" type="geopoint"/>'
const PLAIN_XML = '<bind nodeset="/data/name" type="string"/>'

/** Fresh module per test — the once-per-session guard is module state. */
const loadWarmup = async (): Promise<(xml: string) => Promise<void>> => {
  vi.resetModules()
  return (await import('./geolocationWarmup')).warmUpGeolocation
}

const getCurrentPosition = vi.fn()
const query = vi.fn(async () => ({ state: 'prompt' }))

beforeEach(() => {
  vi.stubGlobal('navigator', {
    geolocation: { getCurrentPosition },
    permissions: { query },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('warmUpGeolocation', () => {
  it('requests a position (triggering the permission prompt) for geo forms', async () => {
    const warmUp = await loadWarmup()
    await warmUp(GEO_XML)
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('does nothing for forms without geo questions', async () => {
    const warmUp = await loadWarmup()
    await warmUp(PLAIN_XML)
    expect(query).not.toHaveBeenCalled()
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('asks at most once per session, even across re-mounts', async () => {
    const warmUp = await loadWarmup()
    await warmUp(GEO_XML)
    await warmUp(GEO_XML)
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('skips the request when the permission is already granted or denied', async () => {
    for (const state of ['granted', 'denied']) {
      query.mockResolvedValueOnce({ state })
      const warmUp = await loadWarmup()
      await warmUp(GEO_XML)
    }
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('still requests when the Permissions API is unavailable', async () => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })
    const warmUp = await loadWarmup()
    await warmUp(GEO_XML)
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('is a no-op when geolocation itself is unavailable', async () => {
    vi.stubGlobal('navigator', {})
    const warmUp = await loadWarmup()
    await expect(warmUp(GEO_XML)).resolves.toBeUndefined()
  })
})
