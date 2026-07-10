// @vitest-environment happy-dom
// createWebHashHistory needs a window/location, so this unit spec runs in
// happy-dom (the unit setup file is environment-agnostic).
import { describe, expect, it, vi } from 'vitest'
import type { Router } from 'vue-router'

// The router captures embedDetection() once at module scope, so each case
// re-evaluates '@/router' against this flag.
const embedActive = vi.hoisted(() => ({ value: false }))
vi.mock('@/embed/detect', () => ({
  embedDetection: () => ({ active: embedActive.value, origin: null }),
}))

const loadRouter = async (active: boolean): Promise<Router> => {
  embedActive.value = active
  vi.resetModules()
  const { router } = await import('@/router')
  return router
}

describe('settings route embed gating', () => {
  it('registers #/settings outside embed mode', async () => {
    const router = await loadRouter(false)
    expect(router.resolve('/settings').name).toBe('settings')
  })

  it('navigates to the settings view outside embed mode', async () => {
    const router = await loadRouter(false)
    await router.push('/settings')
    expect(router.currentRoute.value.name).toBe('settings')
  })

  it('omits the route in embed mode: #/settings falls through the catch-all to /', async () => {
    const router = await loadRouter(true)
    expect(router.resolve('/settings').name).not.toBe('settings')

    await router.push('/settings')
    expect(router.currentRoute.value.path).toBe('/')
    expect(router.currentRoute.value.name).toBe('library')
  })
})
