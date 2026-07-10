import { expect, test } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

// PWA packaging smoke test — chromium only (one engine is enough to prove
// the precache, and Playwright's SW emulation is solid in Chromium).
//
// The e2e build (VITE_E2E=1) only registers the service worker when the page
// opts in with `?pwa=1` (src/pwa/registerSW.ts), so this is the only spec
// that runs with a service worker; the others stay SW-free.
test.describe('pwa offline', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'service worker e2e runs on chromium only')

  test('offline reload serves the app shell and the engine preview', async ({ page, context }) => {
    // First visit downloads the full precache (incl. the ~5 MB engine chunk).
    test.setTimeout(180_000)

    await page.goto('/?pwa=1#/')
    await expect(page.getByTestId('new-form')).toBeVisible()

    // `ready` resolves once the worker is active; workbox finishes the
    // precache during `install`, so everything is cached by then.
    await page.evaluate(async () => { await navigator.serviceWorker.ready })

    await context.setOffline(true)

    // App shell offline: full reload served from the precache.
    await page.reload()
    await expect(page.getByTestId('library-empty')).toBeVisible({ timeout: 30_000 })

    // Build a form and render the live preview offline — proves the lazy
    // odk-web-forms chunk really is in the precache.
    await createForm(page, 'Offline Form')
    await addQuestion(page, 'text')
    await page.getByTestId('preview-button').click()
    const preview = page.getByTestId('preview-host')
    await expect(preview.getByRole('heading', { name: 'Offline Form' })).toBeVisible({ timeout: 60_000 })
    await expect(preview.getByRole('textbox').first()).toBeVisible({ timeout: 10_000 })
  })
})
