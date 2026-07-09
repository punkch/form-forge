import { expect, test } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

test.describe('live preview', () => {
  test('renders in the real engine, updates live, and round-trips a submission', async ({ page }) => {
    await createForm(page, 'Preview Flow')
    await addQuestion(page, 'text')
    await addQuestion(page, 'select_one')

    await page.getByTestId('preview-button').click()
    const preview = page.getByTestId('preview-host')
    // The engine chunk is large; allow a generous first load.
    await expect(preview.getByRole('heading', { name: 'Preview Flow' })).toBeVisible({ timeout: 30_000 })
    await expect(preview.getByText('Option 1')).toBeVisible()

    // Live update: label edit reflects in the preview.
    await page.getByTestId('node-card-text').click()
    await page.getByTestId('prop-label').fill('Favourite meal?')
    await expect(preview.getByText('Favourite meal?')).toBeVisible({ timeout: 5_000 })

    // Broken expression → stale banner, preview stays.
    await page.getByTestId('expr-constraint').fill('count(. > 1')
    await expect(page.getByTestId('preview-stale-banner')).toBeVisible({ timeout: 5_000 })
    await expect(preview.getByText('Favourite meal?')).toBeVisible()

    // Fixing clears the banner.
    await page.getByTestId('expr-constraint').fill('')
    await expect(page.getByTestId('preview-stale-banner')).toHaveCount(0, { timeout: 5_000 })

    // Fill and submit → instance XML dialog.
    await preview.getByRole('textbox').first().fill('Tacos')
    await preview.getByText('Option 2').click()
    await preview.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByTestId('submission-xml')).toContainText('Tacos', { timeout: 10_000 })
    await expect(page.getByTestId('submission-xml')).toContainText('option_2')

    // New instance resets the form.
    await page.getByTestId('submission-new-instance').click()
    await expect(preview.getByRole('textbox').first()).toHaveValue('', { timeout: 10_000 })
  })

  test('switching to a new form never shows the previous form\'s preview', async ({ page }) => {
    await createForm(page, 'Alpha Form')
    await addQuestion(page, 'text')
    await page.getByTestId('preview-button').click()
    const preview = page.getByTestId('preview-host')
    await expect(preview.getByRole('heading', { name: 'Alpha Form' })).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('node-card-text').click()
    await page.getByTestId('prop-label').fill('Alpha question')
    await expect(preview.getByText('Alpha question')).toBeVisible({ timeout: 5_000 })

    // In-app navigation back to the library (no reload — the preview store
    // is app-global, which is exactly what this regression guards).
    await page.getByTestId('back-to-library').click()
    await page.getByTestId('new-form').click()
    await page.getByTestId('new-form-title').fill('Beta Form')
    await page.getByTestId('new-form-create').click()
    await expect(page.getByTestId('editor')).toBeVisible()

    // The still-open preview pane shows the blank-form empty state — never
    // the previous form's rendered questions.
    await expect(page.getByTestId('preview-empty')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('preview-host')).toHaveCount(0)
    await expect(page.getByText('Alpha question')).toHaveCount(0)
    await expect(page.getByTestId('preview-paused-banner')).toHaveCount(0)

    // Building the new form renders its own preview.
    await addQuestion(page, 'text')
    await page.getByTestId('node-card-text').click()
    await page.getByTestId('prop-label').fill('Beta question')
    await expect(preview.getByRole('heading', { name: 'Beta Form' })).toBeVisible({ timeout: 30_000 })
    await expect(preview.getByText('Beta question')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('Alpha question')).toHaveCount(0)
  })
})
