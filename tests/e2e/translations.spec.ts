import { expect, test, type Page } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

/** Adds a language via the Translations dialog (opens it from the tools menu). */
const addLanguage = async (page: Page, name: string, code: string): Promise<void> => {
  await page.getByTestId('editor-more').click()
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

/** Picks the panel editing language and waits for the dropdown to settle. */
const pickPanelLanguage = async (page: Page, option: string): Promise<void> => {
  await page.getByTestId('panel-editing-language').click()
  const item = page.getByRole('option', { name: option, exact: true })
  await item.click()
  await expect(item).toBeHidden() // dropdown overlay gone
}

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

    // The first-language migration keeps the default text: the label is
    // translated; the always-editable (empty) hint row is not.
    await expect(page.getByTestId('lang-completeness-French (fr)')).toContainText('1/2')

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

  test('constraint without a message gets an editable grid row; rare-fields toggle reveals guidance hints', async ({ page }) => {
    await createForm(page, 'Grid Coverage')
    await addQuestion(page, 'text')
    await page.getByTestId('prop-label').fill('How old are you?')
    // A constraint with no message — the grid must still offer the row.
    await page.getByTestId('expr-constraint').fill('string-length(.) < 80')

    await addLanguage(page, 'French', 'fr')

    // Relevance-driven rows: label + hint always, constraint message because
    // the constraint is set — even though no message text exists yet.
    const constraintRow = page.locator('[data-testid^="row-node:"][data-testid$=".constraintMessage"]')
    await expect(constraintRow).toBeVisible()
    // First-language migration translated the label; hint + message are empty.
    await expect(page.getByTestId('lang-completeness-French (fr)')).toContainText('1/3')

    await page.locator('[data-testid^="cell-node:"][data-testid$=".constraintMessage-default"]').fill('Answer too long')
    await page.locator('[data-testid^="cell-node:"][data-testid$=".constraintMessage-French (fr)"]').fill('Réponse trop longue')
    await expect(page.getByTestId('lang-completeness-French (fr)')).toContainText('2/3')

    // Guidance hint hides behind the rarely-used toggle; enabling it reveals
    // the row and grows the completeness denominator.
    const guidanceRow = page.locator('[data-testid^="row-node:"][data-testid$=".guidanceHint"]')
    await expect(guidanceRow).toHaveCount(0)
    await page.getByTestId('show-rarely-used').locator('input').check()
    await expect(guidanceRow).toBeVisible()
    await expect(page.getByTestId('lang-completeness-French (fr)')).toContainText('2/4')
  })

  test('a French-only hint survives XLSForm export and re-import', async ({ page }, testInfo) => {
    await createForm(page, 'Hint Roundtrip')
    await addQuestion(page, 'text')
    await page.getByTestId('prop-name').fill('q1')
    await page.getByTestId('prop-label').fill('Question one')

    await addLanguage(page, 'French', 'fr')

    // French hint only — the default cell stays empty.
    const hintFr = page.locator('[data-testid^="cell-node:"][data-testid$=".hint-French (fr)"]')
    await hintFr.fill('Indice secret')
    await expect(page.locator('[data-testid^="cell-node:"][data-testid$=".hint-default"]')).toHaveValue('')
    await closeTranslationsDialog(page)

    // Export the XLSForm from the split-button menu.
    await page.getByTestId('export-button').getByRole('button').last().click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'XLSForm (.xlsx)' }).click(),
    ])
    const xlsxPath = testInfo.outputPath('hint-roundtrip.xlsx')
    await download.saveAs(xlsxPath)

    // Re-import it as a new form: the French-only hint must survive.
    await page.goto('/#/')
    await page.getByTestId('import-form').click()
    await page.getByTestId('import-file-input').setInputFiles(xlsxPath)
    await expect(page.getByTestId('import-confirm')).toBeEnabled()
    await page.getByTestId('import-confirm').click()
    await expect(page.getByTestId('editor')).toBeVisible()
    await expect(page.getByTestId('node-card-q1')).toBeVisible()

    await page.getByTestId('editor-more').click()
    await page.getByRole('menuitem', { name: 'Translations' }).click()
    await expect(page.getByTestId('language-row-French (fr)')).toBeVisible()
    await expect(page.locator('[data-testid^="cell-node:"][data-testid$=".hint-French (fr)"]')).toHaveValue('Indice secret')
    await expect(page.locator('[data-testid^="cell-node:"][data-testid$=".hint-default"]')).toHaveValue('')
  })

  test('panel editing language writes the selected language and clearing removes only that key', async ({ page }) => {
    await createForm(page, 'Panel Languages')
    await addQuestion(page, 'text')
    await page.getByTestId('prop-label').fill('Your name')
    await page.getByTestId('expr-constraint').fill('string-length(.) > 1')

    // No languages yet: the panel shows no editing-language control.
    await expect(page.getByTestId('panel-editing-language')).toHaveCount(0)
    await addLanguage(page, 'French', 'fr')
    await closeTranslationsDialog(page)

    // Pick French as the panel editing language; the inputs badge it.
    await pickPanelLanguage(page, 'French (fr)')
    await expect(page.getByTestId('panel-editing-language')).toContainText('French (fr)')
    await expect(page.getByTestId('prop-label-lang-badge')).toHaveText('French (fr)')
    // First-language migration copied the default label into French.
    await expect(page.getByTestId('prop-label')).toHaveValue('Your name')

    // Typing a constraint message writes the FRENCH key, not default.
    await page.getByTestId('prop-constraint-message').fill('Message français')
    await pickPanelLanguage(page, 'Default')
    await expect(page.getByTestId('prop-constraint-message')).toHaveValue('')
    await expect(page.getByTestId('prop-label-lang-badge')).toHaveCount(0)

    // The exported XForm carries the French-only message in itext.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-button').getByRole('button', { name: 'Export', exact: true }).click(),
    ])
    const { readFileSync } = await import('node:fs')
    const xml = readFileSync((await download.path()), 'utf8')
    expect(xml).toContain('jr:constraintMsg')
    expect(xml).toContain('Message français')

    // Clearing the French label removes only the French key: the fallback
    // moves to the placeholder and the default value is untouched.
    await pickPanelLanguage(page, 'French (fr)')
    await expect(page.getByTestId('prop-constraint-message')).toHaveValue('Message français')
    await page.getByTestId('prop-label').fill('')
    await expect(page.getByTestId('prop-label')).toHaveAttribute('placeholder', 'Your name')
    await pickPanelLanguage(page, 'Default')
    await expect(page.getByTestId('prop-label')).toHaveValue('Your name')
  })
})
