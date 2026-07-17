import { expect, test } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

const QUESTION_COUNT = 12

/** Zero-padded so no label is a substring of another ("Question 01".."Question 12"),
 * keeping `.filter({ hasText })` lookups below unambiguous. */
const labelFor = (n: number): string => `Question ${String(n).padStart(2, '0')}`

test.describe('preview follows canvas selection', () => {
  test('selecting a canvas card scrolls the matching preview question into view', async ({ page }) => {
    await createForm(page, 'Follow Selection Flow')

    // A dozen text questions render taller than the preview pane, so most of
    // them start out of view and following a selection actually has to scroll.
    for (let i = 1; i <= QUESTION_COUNT; i++) {
      await addQuestion(page, 'text')
      await page.getByTestId('prop-label').fill(labelFor(i))
    }

    // Select the first question so the preview's follow-on-load lands at the
    // top, matching where an untouched scroll position would be anyway.
    await page.getByTestId('node-card-text').click()

    await page.getByTestId('preview-button').click()
    const previewPanel = page.getByTestId('preview-panel')
    // The engine chunk is large; allow a generous first load.
    await expect(page.getByTestId('preview-host')).toBeVisible({ timeout: 30_000 })
    await expect(previewPanel.getByText(labelFor(1))).toBeVisible({ timeout: 10_000 })

    const questionContainer = (label: string) =>
      previewPanel.locator('.question-container').filter({ hasText: label })

    const late = questionContainer(labelFor(11))
    const early = questionContainer(labelFor(2))
    await expect(late).not.toBeInViewport()

    // Selecting a late canvas card scrolls the preview to follow it.
    // toBeInViewport() auto-retries through the smooth scroll animation.
    await page.getByTestId('node-card-text_11').click()
    await expect(late).toBeInViewport()

    // Selecting an early card scrolls the preview back — the late question
    // scrolls back out of view.
    await page.getByTestId('node-card-text_2').click()
    await expect(early).toBeInViewport()
    await expect(late).not.toBeInViewport()
  })
})
