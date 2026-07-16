import { expect, test } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

test.describe('form editor', () => {
  test('build a nested form with keyboard moves, edit properties, undo/redo', async ({ page }) => {
    await createForm(page, 'Editor Flow')

    await addQuestion(page, 'text')
    await addQuestion(page, 'group')
    await addQuestion(page, 'integer')

    // Rename the integer and set a constraint via the property panel.
    await page.getByTestId('prop-name').fill('age')
    await page.getByTestId('expr-constraint').fill('. >= 0 and . <= 120')
    await expect(page.getByTestId('node-card-age')).toBeVisible()

    // Keyboard: indent the integer into the preceding group.
    await page.getByTestId('node-card-age').click()
    await page.keyboard.press('Alt+ArrowRight')
    await expect(
      page.locator('[data-testid^="container-list-"] [data-testid="node-card-age"]')
    ).toBeVisible()

    // And back out.
    await page.keyboard.press('Alt+ArrowLeft')
    await expect(
      page.locator('[data-testid^="container-list-"] [data-testid="node-card-age"]')
    ).toHaveCount(0)

    // Undo collapses the move; redo re-applies it.
    await page.keyboard.press('Control+z')
    await expect(
      page.locator('[data-testid^="container-list-"] [data-testid="node-card-age"]')
    ).toBeVisible()
    await page.keyboard.press('Control+y')
    await expect(
      page.locator('[data-testid^="container-list-"] [data-testid="node-card-age"]')
    ).toHaveCount(0)

    // Duplicate names surface in Problems and inline.
    await page.getByTestId('node-card-text').click()
    await page.getByTestId('prop-name').fill('age')
    await page.getByTestId('problems-button').click()
    await expect(page.getByTestId('problems-list')).toContainText('used 2 times')
  })

  test('structure persists across reload', async ({ page }) => {
    await createForm(page, 'Persistence Flow')
    await addQuestion(page, 'text')
    await addQuestion(page, 'select_one')
    // Let autosave flush.
    await expect(page.getByTestId('save-indicator')).toContainText('All changes saved')

    await page.reload()
    await expect(page.getByTestId('node-card-text')).toBeVisible()
    await expect(page.getByTestId('node-card-select_one')).toBeVisible()
  })

  test('with no Central server the header shows a zero-state Central button routing to Settings', async ({ page }) => {
    await createForm(page, 'Central Zero State')

    // A fresh workspace has no Central servers, so the normal drawer toggle is
    // absent and the zero-state affordance renders in its place.
    await expect(page.getByTestId('central-button')).toHaveCount(0)
    await page.getByTestId('central-zero-state').click()

    await expect(page.getByTestId('settings-view')).toBeVisible()
    await expect(page.getByTestId('settings-central')).toBeInViewport()
  })
})
