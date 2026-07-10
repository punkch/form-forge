import { expect, test, type Page } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

/** Opens the Translations dialog from the editor tools menu. */
const openTranslationsDialog = async (page: Page): Promise<void> => {
  await page.getByTestId('editor-more').click()
  await page.getByRole('menuitem', { name: 'Translations' }).click()
  await expect(page.getByTestId('translations-dialog')).toBeVisible()
}

const closeTranslationsDialog = async (page: Page): Promise<void> => {
  await page.getByTestId('translations-dialog').getByRole('button', { name: 'Close' }).click()
  await expect(page.getByTestId('translations-dialog')).toBeHidden()
}

test.describe('workflow guides', () => {
  test('help drawer lists guides, search narrows them, and a guide renders its steps', async ({ page }) => {
    await createForm(page, 'Guides Drawer')

    await page.getByTestId('help-button').click()
    await expect(page.getByTestId('help-drawer')).toBeVisible()
    await expect(page.getByTestId('help-guides-section')).toBeVisible()
    await expect(page.getByTestId('help-guide-item-translations')).toBeVisible()
    await expect(page.getByTestId('help-guide-item-keyboard')).toBeVisible()

    // One search box filters guides and question types together.
    await page.getByTestId('help-search').fill('logic')
    await expect(page.getByTestId('help-guide-item-logic')).toBeVisible()
    await expect(page.getByTestId('help-guide-item-backup')).toHaveCount(0)

    await page.getByTestId('help-guide-item-logic').click()
    await expect(page.getByTestId('help-guide-logic')).toBeVisible()
    await expect(page.getByTestId('help-drawer')).toContainText('Building logic visually')
    await expect(page.getByTestId('guide-steps')).toContainText('Add condition')
    await expect(page.getByTestId('guide-read-more')).toHaveAttribute(
      'href',
      'https://docs.getodk.org/form-logic/'
    )

    // Back returns to the searchable list.
    await page.getByTestId('help-ref-back').click()
    await expect(page.getByTestId('help-search')).toBeVisible()
    await expect(page.getByTestId('help-guides-section')).toBeVisible()
  })

  test('the Translations dialog "?" opens the translations guide', async ({ page }) => {
    await createForm(page, 'Guides Translations')

    await openTranslationsDialog(page)
    await page.getByTestId('guide-trigger-translations').click()

    // The drawer replaces the dialog (one activeDialog at a time) and opens
    // straight at the guide detail.
    await expect(page.getByTestId('help-drawer')).toBeVisible()
    await expect(page.getByTestId('help-guide-translations')).toBeVisible()
    await expect(page.getByTestId('help-drawer')).toContainText('Translating a form')
  })

  test('the translations callout shows on first open, dismisses, and the dismissal survives reload', async ({ page }) => {
    await createForm(page, 'Guides Callout')

    await openTranslationsDialog(page)
    await expect(page.getByTestId('guide-callout-translations')).toBeVisible()
    await page.getByTestId('guide-callout-dismiss-translations').click()
    await expect(page.getByTestId('guide-callout-translations')).toHaveCount(0)
    await closeTranslationsDialog(page)

    // Reopening in the same session: still gone.
    await openTranslationsDialog(page)
    await expect(page.getByTestId('guide-callout-translations')).toHaveCount(0)
    await closeTranslationsDialog(page)

    // The dismissal is persisted (ui store → localStorage), so a full reload
    // must not resurrect the callout.
    await page.reload()
    await expect(page.getByTestId('editor')).toBeVisible()
    await openTranslationsDialog(page)
    await expect(page.getByTestId('guide-callout-translations')).toHaveCount(0)
    // The pull-based "?" stays available after the callout is gone.
    await expect(page.getByTestId('guide-trigger-translations')).toBeVisible()
  })

  test('logic section "?" opens the logic guide; forced raw mode shows the dismissable callout', async ({ page }) => {
    await createForm(page, 'Guides Logic')
    await addQuestion(page, 'text')

    // An expression the visual grammar cannot represent (if() is not in the
    // condition grammar) forces raw mode and surfaces the first-use callout.
    await page.getByTestId('expr-relevant').fill("if(. = '', 'yes', 'no') = 'yes'")
    await expect(page.getByTestId('guide-callout-logicRaw')).toBeVisible()
    await page.getByTestId('guide-callout-dismiss-logicRaw').click()
    await expect(page.getByTestId('guide-callout-logicRaw')).toHaveCount(0)

    await page.getByTestId('guide-trigger-logic').click()
    await expect(page.getByTestId('help-drawer')).toBeVisible()
    await expect(page.getByTestId('help-guide-logic')).toBeVisible()
  })

  test('the library toolbar "?" opens the drawer guide list', async ({ page }) => {
    await page.goto('/#/')

    await page.getByTestId('library-help').click()
    await expect(page.getByTestId('help-drawer')).toBeVisible()
    // Opens straight on the browsable list, not a specific guide.
    await expect(page.getByTestId('help-guides-section')).toBeVisible()

    // From the list, the backup guide detail is one click away.
    await page.getByTestId('help-guide-item-backup').click()
    await expect(page.getByTestId('help-guide-backup')).toBeVisible()
    await expect(page.getByTestId('help-drawer')).toContainText('Backing up your workspace')

    // Back returns to the list.
    await page.getByTestId('help-ref-back').click()
    await expect(page.getByTestId('help-guides-section')).toBeVisible()
  })
})
