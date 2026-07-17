import { expect, test, type Page } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

// Tiny valid 1x1 transparent PNG, reused for every upload fixture in this file.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

const pngFile = (name: string): { name: string, mimeType: string, buffer: Buffer } =>
  ({ name, mimeType: 'image/png', buffer: PNG_1X1 })

const openAttachmentsDialog = async (page: Page): Promise<void> => {
  await page.getByTestId('form-menu').click()
  await page.getByRole('menuitem', { name: 'Attachments' }).click()
  await expect(page.getByTestId('attachments-dialog')).toBeVisible()
}

const closeAttachmentsDialog = async (page: Page): Promise<void> => {
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('attachments-dialog')).toBeHidden()
}

/** Adds a language via the Translations dialog (opens it from the tools menu) —
 * mirrors tests/e2e/translations.spec.ts's helper of the same shape. */
const addLanguage = async (page: Page, name: string, code: string): Promise<void> => {
  await page.getByTestId('form-menu').click()
  await page.getByRole('menuitem', { name: 'Translations' }).click()
  await page.getByPlaceholder('French').fill(name)
  await page.getByPlaceholder('fr', { exact: true }).fill(code)
  await page.getByRole('button', { name: 'Add language' }).click()
  await expect(page.getByTestId(`language-row-${name} (${code})`)).toBeVisible()
}

const closeTranslationsDialog = async (page: Page): Promise<void> => {
  await page.getByTestId('translations-dialog').getByRole('button', { name: 'Close' }).click()
  await expect(page.getByTestId('translations-dialog')).toBeHidden()
}

test.describe('media labels & annotation', () => {
  test('annotate default image: warns when missing, resolves via the Missing row upload', async ({ page }) => {
    await createForm(page, 'Annotate Default')
    await addQuestion(page, 'image')
    await expect(page.getByTestId('node-card-image')).toBeVisible()

    // Appearance: annotate.
    const appearance = page.getByTestId('prop-appearance')
    await appearance.locator('.p-select-dropdown').click()
    await page.locator('.p-select-option', { hasText: 'annotate' }).click()
    await expect(appearance.locator('input')).toHaveValue('annotate')

    // Pick the default image by uploading straight through the properties picker.
    await page.getByTestId('prop-default-image-upload-input').setInputFiles(pngFile('template.png'))
    await expect(page.getByTestId('prop-default-image-status')).toHaveAttribute('data-state', 'attached')
    await expect(page.getByTestId('prop-default-image-status')).toContainText('template.png')

    // Problems clean.
    await page.getByTestId('problems-button').click()
    await expect(page.getByTestId('problems-list')).toContainText('No problems found')
    await page.keyboard.press('Escape')

    // Delete the attachment from the Attachments dialog: the default still
    // names it, so a Missing row appears for the now-orphaned filename.
    await openAttachmentsDialog(page)
    const attachedRow = page.locator('.attachment-row', { hasText: 'template.png' })
    await expect(attachedRow.getByTestId('attachment-ref-count')).toContainText('Used by 1')
    await attachedRow.getByRole('button', { name: 'Delete template.png' }).click()
    const missingRow = page.locator('.attachment-row', { hasText: 'template.png' })
    await expect(missingRow.getByTestId('attachment-missing')).toBeVisible()
    await closeAttachmentsDialog(page)

    // The Problems panel now shows the default-image warning.
    await page.getByTestId('problems-button').click()
    await expect(page.getByTestId('problems-list')).toContainText(
      'Default image "template.png" is referenced but has not been uploaded.'
    )
    await page.keyboard.press('Escape')

    // The properties picker also reflects the missing state.
    await expect(page.getByTestId('prop-default-image-status')).toHaveAttribute('data-state', 'missing')

    // Uploading from the Missing row resolves the warning.
    await openAttachmentsDialog(page)
    await missingRow.getByTestId('attachment-upload-missing').click()
    await page.getByTestId('attachment-replace-input').setInputFiles(pngFile('template.png'))
    await expect(page.getByTestId('attachment-missing')).toHaveCount(0)
    await closeAttachmentsDialog(page)

    await page.getByTestId('problems-button').click()
    await expect(page.getByTestId('problems-list')).toContainText('No problems found')
    await page.keyboard.press('Escape')

    await expect(page.getByTestId('prop-default-image-status')).toHaveAttribute('data-state', 'attached')
    await expect(page.getByTestId('prop-default-image-status')).toContainText('template.png')
  })

  test('label media: add an image, translate it, rename the attachment', async ({ page }) => {
    await createForm(page, 'Label Media')
    await addQuestion(page, 'text')
    await expect(page.getByTestId('node-card-text')).toBeVisible()

    // Add label media (Image) and upload straight through the picker.
    await page.getByTestId('prop-media-add').click()
    await page.getByTestId('prop-media-add-image').click()
    await expect(page.getByTestId('prop-media-image')).toBeVisible()
    await page.getByTestId('prop-media-image-upload-input').setInputFiles(pngFile('label.png'))
    await expect(page.getByTestId('prop-media-image-status')).toHaveAttribute('data-state', 'attached')

    // Attachments dialog shows the reference.
    await openAttachmentsDialog(page)
    await expect(
      page.locator('.attachment-row', { hasText: 'label.png' }).getByTestId('attachment-ref-count')
    ).toContainText('Used by 1')
    await closeAttachmentsDialog(page)

    // Translating: adding the first language fans the filename out — the
    // node-media row exists and the French cell carries it.
    await addLanguage(page, 'French', 'fr')
    const frenchCell = page.locator('[data-testid^="cell-node-media:"][data-testid$=".image-French (fr)"]')
    await expect(page.locator('[data-testid^="row-node-media:"][data-testid$=".image"]')).toBeVisible()
    await expect(frenchCell).toHaveValue('label.png')
    await closeTranslationsDialog(page)

    // Rename the attachment: the picker and the grid cell follow the new name.
    await openAttachmentsDialog(page)
    await page.locator('.attachment-row', { hasText: 'label.png' }).getByTestId('attachment-rename').click()
    await expect(page.getByTestId('rename-attachment-dialog')).toBeVisible()
    await page.getByTestId('rename-attachment-stem').fill('renamed')
    await page.getByTestId('rename-attachment-confirm').click()
    await expect(page.getByTestId('rename-attachment-dialog')).toBeHidden()
    await expect(page.locator('.attachment-row', { hasText: 'renamed.png' })).toBeVisible()
    await closeAttachmentsDialog(page)

    await expect(page.getByTestId('prop-media-image-status')).toContainText('renamed.png')

    await page.getByTestId('form-menu').click()
    await page.getByRole('menuitem', { name: 'Translations' }).click()
    await expect(frenchCell).toHaveValue('renamed.png')
  })

  test('choice media: upload an image via a choice row popover', async ({ page }) => {
    await createForm(page, 'Choice Media')
    await addQuestion(page, 'select_one')
    await expect(page.getByTestId('node-card-select_one')).toBeVisible()

    // Scroll the trigger into view as its own step before clicking: Playwright's
    // `.click()` bundles an implicit scroll-into-view with the click itself,
    // and that scroll event lands on the properties panel's scrollable
    // ancestor right as the popover opens and binds its scroll-to-dismiss
    // listener — closing it before the click is even done. Real users scroll
    // and click as separate gestures, so this never bites them; scrolling
    // first here just avoids the artifact.
    await page.getByTestId('choice-media-0').scrollIntoViewIfNeeded()
    await page.getByTestId('choice-media-0').click()
    await expect(page.getByTestId('choice-media-popover')).toBeVisible()
    await page.getByTestId('choice-media-add-0-image').click()

    const picker = page.getByTestId('choice-media-0-image')
    await expect(picker).toBeVisible()
    await page.getByTestId('choice-media-0-image-upload-input').setInputFiles(pngFile('choice.png'))
    await expect(page.getByTestId('choice-media-0-image-status')).toHaveAttribute('data-state', 'attached')
    await expect(page.getByTestId('choice-media-0-image-status')).toContainText('choice.png')
    await page.keyboard.press('Escape')

    // The choice-level reference counts in the Attachments dialog.
    await openAttachmentsDialog(page)
    await expect(
      page.locator('.attachment-row', { hasText: 'choice.png' }).getByTestId('attachment-ref-count')
    ).toContainText('Used by 1')
    await closeAttachmentsDialog(page)
  })
})
