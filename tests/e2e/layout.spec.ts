import { expect, test, type Page } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

/** Panel folds animate grid-template-columns — poll until the width settles. */
const panelWidth = async (page: Page): Promise<number> => {
  const box = await page.getByTestId('property-panel').boundingBox()
  return Math.round(box!.width)
}

test.describe('adaptive layout', () => {
  test('properties rail folds and expands with selection', async ({ page }) => {
    await createForm(page, 'Layout Rail')

    // Nothing selected yet: the properties panel is a slim rail.
    await expect(page.getByTestId('property-rail')).toBeVisible()
    await expect.poll(() => panelWidth(page)).toBeLessThan(60)

    // Selecting a question expands the panel to its full width.
    await addQuestion(page, 'text')
    await expect(page.getByTestId('prop-name')).toBeVisible()
    await expect.poll(() => panelWidth(page)).toBeGreaterThan(280)
  })

  test('split handles resize with the keyboard and persist across reload', async ({ page }) => {
    await createForm(page, 'Layout Resize')
    await addQuestion(page, 'text')

    const handle = page.getByTestId('split-properties')
    await handle.focus()
    // Properties panel sits after ('end' of) the handle: ArrowLeft grows it.
    await page.keyboard.press('Shift+ArrowLeft')
    await page.keyboard.press('Shift+ArrowLeft')
    await expect(handle).toHaveAttribute('aria-valuenow', '488')

    await expect(page.getByTestId('save-indicator')).toContainText('All changes saved')
    await page.reload()
    await page.getByTestId('node-card-text').click()
    await expect.poll(() => panelWidth(page)).toBe(488)

    // Double-click resets to the default width.
    await page.getByTestId('split-properties').dblclick()
    await expect.poll(() => panelWidth(page)).toBe(360)
  })

  test('laptop mode docks the preview without covering the properties panel', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 })
    await createForm(page, 'Layout Laptop')
    // The palette is a drawer in laptop mode; it closes again after the add.
    await page.getByTestId('palette-toggle').click()
    await addQuestion(page, 'text')

    await page.getByTestId('preview-button').click()
    await expect(page.getByTestId('preview-panel')).toBeVisible()
    await expect(page.getByTestId('prop-name')).toBeVisible()

    const props = await page.getByTestId('property-panel').boundingBox()
    const preview = await page.getByTestId('preview-panel').boundingBox()
    // Panels sit side by side — the preview starts at or after the properties panel's right edge.
    expect(preview!.x).toBeGreaterThanOrEqual(props!.x + props!.width - 1)
    // Nothing overflows the viewport horizontally.
    expect(preview!.x + preview!.width).toBeLessThanOrEqual(1100 + 1)
  })

  test('tablet mode switches panes with tabs', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 })
    await createForm(page, 'Layout Tablet')
    await expect(page.getByTestId('editor-tabs')).toBeVisible()

    // The palette is a drawer in tablet mode.
    await page.getByTestId('palette-toggle').click()
    await addQuestion(page, 'text')

    await page.getByTestId('editor-tab-properties').click()
    await expect(page.getByTestId('prop-name')).toBeVisible()

    await page.getByTestId('editor-tab-preview').click()
    await expect(page.getByTestId('preview-panel')).toBeVisible()

    await page.getByTestId('editor-tab-canvas').click()
    await expect(page.getByTestId('node-card-text')).toBeVisible()
  })

  test('phone size blocks authoring but keeps library and full preview usable', async ({ page }) => {
    await createForm(page, 'Layout Phone')
    await addQuestion(page, 'text')
    await expect(page.getByTestId('save-indicator')).toContainText('All changes saved')

    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByTestId('editor-blocked')).toBeVisible()

    await page.getByTestId('blocked-open-preview').click()
    await expect(page.getByTestId('back-to-editor')).toBeVisible()
    await expect(page.locator('.full-preview-body')).toBeVisible()
  })
})
