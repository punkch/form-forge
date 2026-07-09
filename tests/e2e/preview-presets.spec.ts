import { expect, test } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

test.describe('preview presets and error containment', () => {
  test('device presets set the preview content width and persist', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await createForm(page, 'Preset Flow')
    await addQuestion(page, 'text')

    await page.getByTestId('preview-button').click()
    await expect(page.locator('.preview-mount')).toBeVisible({ timeout: 15000 })

    await page.getByTestId('preview-preset-phone').click()
    const phone = await page.locator('.preview-mount').boundingBox()
    expect(Math.round(phone!.width)).toBe(360)

    await page.getByTestId('preview-preset-fill').click()
    const fill = await page.locator('.preview-mount').boundingBox()
    expect(fill!.width).toBeGreaterThan(380)

    // The preset is a device-level preference: it survives a reload.
    await page.getByTestId('preview-preset-phone').click()
    await expect(page.getByTestId('save-indicator')).toContainText('All changes saved')
    await page.reload()
    await page.getByTestId('preview-button').click()
    await expect(page.locator('.preview-mount')).toBeVisible({ timeout: 15000 })
    const persisted = await page.locator('.preview-mount').boundingBox()
    expect(Math.round(persisted!.width)).toBe(360)
  })

  test('an empty group pauses the preview instead of crashing it', async ({ page }) => {
    // Wide enough that the palette stays docked while the preview is open.
    await page.setViewportSize({ width: 1440, height: 900 })
    await createForm(page, 'Empty Group Flow')
    await addQuestion(page, 'text')

    await page.getByTestId('preview-button').click()
    await expect(page.locator('.preview-mount')).toBeVisible({ timeout: 15000 })

    // An empty group would crash the engine — the preview pauses instead,
    // keeping the last good render, and no raw engine error appears anywhere.
    await addQuestion(page, 'group')
    await expect(page.getByTestId('preview-paused-banner')).toBeVisible()
    await expect(page.locator('.preview-mount')).toBeVisible()
    await expect(page.getByText('Unexpected body element')).toHaveCount(0)

    // The paused banner never covers the properties panel.
    const banner = await page.getByTestId('preview-paused-banner').boundingBox()
    const props = await page.getByTestId('property-panel').boundingBox()
    expect(banner!.x).toBeGreaterThanOrEqual(props!.x + props!.width - 1)

    // Filling the group (the selected container) resumes the preview.
    await addQuestion(page, 'integer')
    await expect(page.getByTestId('preview-paused-banner')).toHaveCount(0)
  })
})
