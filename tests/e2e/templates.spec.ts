import { expect, test } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

test.describe('form templates', () => {
  test('creates a form from a bundled template that validates and previews', async ({ page }) => {
    await page.goto('/#/')
    await page.getByTestId('new-form').click()

    // Gallery shows the four bundled starters.
    await expect(page.getByTestId('new-form-template-household-survey')).toBeVisible()
    await expect(page.getByTestId('new-form-template-feedback-satisfaction')).toBeVisible()

    await page.getByTestId('new-form-template-household-survey').click()
    // Step 2 prefills the title from the template.
    await expect(page.getByTestId('new-form-title')).toHaveValue('Household survey')
    await page.getByTestId('new-form-create').click()
    await expect(page.getByTestId('editor')).toBeVisible()

    // 13 questions + 1 repeat container render on the canvas.
    await expect(page.locator('[data-testid^="node-card-"]')).toHaveCount(14)
    await expect(page.getByTestId('node-card-interview_date')).toBeVisible()

    // Zero problems: the template instantiates without errors or warnings.
    await page.getByTestId('problems-button').click()
    await expect(page.getByTestId('problems-list')).toContainText('No problems found.')
    await page.keyboard.press('Escape')

    // The real engine renders the instantiated form.
    await page.getByTestId('preview-button').click()
    const preview = page.getByTestId('preview-host')
    await expect(preview.getByRole('heading', { name: 'Household survey' })).toBeVisible({ timeout: 30_000 })
    await expect(preview.getByText('Date of interview')).toBeVisible()
  })

  test('save as template, reload, and instantiate from the gallery', async ({ page }) => {
    await createForm(page, 'Template Source')
    await addQuestion(page, 'text')
    await addQuestion(page, 'integer')
    await page.getByTestId('back-to-library').click()

    // Save the form as a local template.
    await page.getByTestId('form-card-template_source').getByTestId('form-card-menu').click()
    await page.getByRole('menuitem', { name: 'Save as template' }).click()
    await expect(page.getByTestId('save-template-name')).toHaveValue('Template Source')
    await page.getByTestId('save-template-name').fill('My Starter')
    await page.getByTestId('save-template-description').fill('Two quick questions')
    await page.getByTestId('save-template-confirm').click()
    // Wait for the write to land (toast + dialog close) before reloading.
    await expect(page.getByText('Template saved')).toBeVisible()
    await expect(page.getByTestId('save-template-name')).toHaveCount(0)

    // Local templates survive a full reload (IndexedDB persistence).
    await page.reload()
    await page.getByTestId('new-form').click()
    const localCard = page.getByTestId('new-form-local-template')
    await expect(localCard).toBeVisible()
    await expect(localCard).toContainText('My Starter')
    await expect(localCard).toContainText('Two quick questions')
    await expect(localCard).toContainText('Local')

    // Instantiate from it.
    await localCard.getByTestId('new-form-local-open').click()
    await expect(page.getByTestId('new-form-title')).toHaveValue('My Starter')
    await page.getByTestId('new-form-title').fill('From My Starter')
    await page.getByTestId('new-form-create').click()
    await expect(page.getByTestId('editor')).toBeVisible()
    await expect(page.locator('[data-testid^="node-card-"]')).toHaveCount(2)

    // Both the source form and the new instance exist side by side.
    await page.getByTestId('back-to-library').click()
    await expect(page.getByTestId('form-card-template_source')).toBeVisible()
    await expect(page.getByTestId('form-card-from_my_starter')).toBeVisible()
  })
})
