import { expect, test } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

test.describe('translations', () => {
  test('add a language, translate, switch display language, itext exports', async ({ page }) => {
    await createForm(page, 'Translation Flow')
    await addQuestion(page, 'text')
    await page.getByTestId('prop-label').fill('Hello')

    // Open the translations dialog from the tools menu.
    await page.getByTestId('editor-more').click()
    await page.getByRole('menuitem', { name: 'Translations' }).click()
    await page.getByPlaceholder('French').fill('French')
    await page.getByPlaceholder('fr', { exact: true }).fill('fr')
    await page.getByRole('button', { name: 'Add language' }).click()
    await expect(page.getByTestId('language-row-French (fr)')).toBeVisible()

    // The first-language migration keeps the default text: completeness full.
    await expect(page.getByTestId('lang-completeness-French (fr)')).toContainText('1/1')

    // Translate the label cell to French.
    const frenchCell = page.locator('[data-testid^="cell-"][data-testid$="-French (fr)"]').first()
    await frenchCell.fill('Bonjour')

    // Switch the canvas display language to French, close the dialog and
    // check the card renders the translation.
    await page.getByTestId('display-language').click()
    const frenchOption = page.getByRole('option', { name: 'French (fr)' })
    await frenchOption.click()
    await expect(frenchOption).toBeHidden() // dropdown overlay gone
    await page.getByTestId('translations-dialog').getByRole('button', { name: 'Close' }).click()
    await expect(page.getByTestId('translations-dialog')).toBeHidden()
    await expect(page.getByTestId('node-card-text')).toContainText('Bonjour')

    // Exported XML carries itext with the translation.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-button').getByRole('button', { name: 'Export', exact: true }).click(),
    ])
    const { readFileSync } = await import('node:fs')
    const xml = readFileSync((await download.path()), 'utf8')
    expect(xml).toContain('<translation lang="French (fr)" default="true()">')
    expect(xml).toContain('Bonjour')
  })

  test('removing a language strips its translations after confirmation', async ({ page }) => {
    await createForm(page, 'Removal Flow')
    await addQuestion(page, 'text')
    await page.getByTestId('editor-more').click()
    await page.getByRole('menuitem', { name: 'Translations' }).click()
    await page.getByPlaceholder('French').fill('Spanish')
    await page.getByPlaceholder('fr', { exact: true }).fill('es')
    await page.getByRole('button', { name: 'Add language' }).click()
    await expect(page.getByTestId('language-row-Spanish (es)')).toBeVisible()

    await page.getByTestId('remove-language-Spanish (es)').click()
    await page.getByTestId('remove-confirm-button').click()
    await expect(page.getByTestId('language-row-Spanish (es)')).toHaveCount(0)
  })
})
