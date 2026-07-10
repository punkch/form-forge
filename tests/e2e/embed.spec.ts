import { expect, test } from '@playwright/test'

// The demo host page (public/embed-demo.html) drives the builder in an iframe
// through the postMessage protocol; its message log is the assertion surface
// for both directions of the handshake.
test.describe('embed mode', () => {
  // The host page's log pane takes 380px; keep the iframe itself ≥1280px so
  // the embedded editor runs in the wide layout with the properties panel docked.
  test.use({ viewport: { width: 1720, height: 900 } })

  test('host drives init, load, edit, save and load-back over postMessage', async ({ page }) => {
    await page.goto('/embed-demo.html')
    const log = page.locator('#message-log')
    const frame = page.frameLocator('#builder-frame')

    // Boot: builder posts ready; the waiting screen shows until a form loads.
    await expect(log).toContainText('"type":"ready"')
    await expect(frame.getByTestId('embed-waiting')).toBeVisible()

    await page.click('#btn-init')
    await expect(log).toContainText('"type":"init-result"')

    // Load the sample object-format form → editor opens with its questions.
    await page.click('#btn-load-sample')
    await expect(log).toContainText('"type":"load-form-result"')
    await expect(frame.getByTestId('node-card-visitor_name')).toBeVisible()
    await expect(frame.getByTestId('node-card-visitor_age')).toBeVisible()

    // Embed chrome: no back-to-library navigation.
    await expect(frame.getByTestId('back-to-library')).toHaveCount(0)

    // Edit a label → a state-changed event with dirty:true reaches the host.
    await frame.getByTestId('node-card-visitor_name').click()
    await frame.getByTestId('prop-label').fill('Full visitor name')
    await expect(log).toContainText('"dirty":true')

    // Save as archive → meta and byte size are rendered by the host page.
    await page.click('#btn-save')
    await expect(log).toContainText('"type":"save-form-result"')
    const meta = page.locator('#save-meta')
    await expect(meta).toContainText('formId: embedded_sample')
    await expect(meta).toContainText('errorCount: 0')
    await expect(meta).toContainText('bytes: ')

    // Load the saved archive back in → the edited label survived.
    await page.click('#btn-load-back')
    await expect(frame.getByTestId('node-card-visitor_name')).toBeVisible()
    await expect(frame.getByTestId('node-card-visitor_name')).toContainText('Full visitor name')
  })

  test('init with all exports disabled hides the export menu', async ({ page }) => {
    await page.goto('/embed-demo.html')
    const log = page.locator('#message-log')
    const frame = page.frameLocator('#builder-frame')
    await expect(log).toContainText('"type":"ready"')

    await page.locator('#opt-no-exports').check()
    await page.click('#btn-init')
    await expect(log).toContainText('"type":"init-result"')

    await page.click('#btn-load-sample')
    await expect(frame.getByTestId('node-card-visitor_name')).toBeVisible()
    await expect(frame.getByTestId('export-button')).toHaveCount(0)
  })
})
