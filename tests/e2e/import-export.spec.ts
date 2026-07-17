import { expect, test } from '@playwright/test'

test.describe('import and export', () => {
  test('XLSForm import → editor → XML/XLSForm/ZIP exports', async ({ page }) => {
    await page.goto('/#/')
    await page.getByTestId('import-form').click()
    await page.getByTestId('import-file-input').setInputFiles('tests/golden/src/cascade.xlsx')
    await expect(page.getByTestId('import-report')).toContainText('No problems found')
    await page.getByTestId('import-confirm').click()

    await expect(page.getByTestId('editor')).toBeVisible()
    await expect(page.getByTestId('node-card-district')).toBeVisible()

    // XForm XML export (SplitButton primary action)
    const [xmlDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-button').getByRole('button', { name: 'Export', exact: true }).click(),
    ])
    expect(xmlDownload.suggestedFilename()).toMatch(/cascade_test.*\.xml$/)
    const xmlPath = await xmlDownload.path()
    const { readFileSync } = await import('node:fs')
    const xml = readFileSync(xmlPath, 'utf8')
    expect(xml).toContain('<itemset nodeset="instance(\'district\')/root/item[state=')

    // XLSForm export from the menu
    await page.getByTestId('export-button').getByRole('button').last().click()
    const [xlsxDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'XLSForm (.xlsx)' }).click(),
    ])
    expect(xlsxDownload.suggestedFilename()).toMatch(/\.xlsx$/)
    const xlsxBytes = readFileSync((await xlsxDownload.path()))
    expect(xlsxBytes[0]).toBe(0x50) // 'P'
    expect(xlsxBytes[1]).toBe(0x4b) // 'K' — zip container

    // ZIP export — XForm XML variant
    await page.getByTestId('export-button').getByRole('button').last().click()
    const [xformZipDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'ZIP · XForm XML + attachments' }).click(),
    ])
    expect(xformZipDownload.suggestedFilename()).toMatch(/-xform\.zip$/)

    // ZIP export — XLSForm variant
    await page.getByTestId('export-button').getByRole('button').last().click()
    const [xlsformZipDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'ZIP · XLSForm + attachments' }).click(),
    ])
    expect(xlsformZipDownload.suggestedFilename()).toMatch(/-xlsform\.zip$/)
  })

  test('XForm XML import round-trips the all-widgets fixture', async ({ page }) => {
    await page.goto('/#/')
    await page.getByTestId('import-form').click()
    await page.getByTestId('import-file-input').setInputFiles('tests/fixtures/all-widgets.xml')
    await expect(page.getByTestId('import-report')).toContainText('0 errors')
    await page.getByTestId('import-confirm').click()

    // Library or editor — the record must exist with all questions.
    await page.goto('/#/')
    await expect(page.getByTestId('form-card-all-widgets')).toContainText('73 questions')
  })

  test('import rejects unsupported files with a clear error', async ({ page }) => {
    await page.goto('/#/')
    await page.getByTestId('import-form').click()
    await page.getByTestId('import-file-input').setInputFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    })
    await expect(page.getByTestId('import-report')).toContainText('not an XForm')
    await expect(page.getByTestId('import-confirm')).toBeDisabled()
  })

  test('ZIP bundle export round-trips a form and its attachment', async ({ page }, testInfo) => {
    await page.goto('/#/')
    await page.getByTestId('import-form').click()
    await page.getByTestId('import-file-input').setInputFiles('tests/golden/src/cascade.xlsx')
    await expect(page.getByTestId('import-report')).toContainText('No problems found')
    await page.getByTestId('import-confirm').click()
    await expect(page.getByTestId('editor')).toBeVisible()

    // Attach a small file through the Attachments dialog.
    await page.getByTestId('form-menu').click()
    await page.getByRole('menuitem', { name: 'Attachments' }).click()
    await page.getByTestId('attachment-file-input').setInputFiles({
      name: 'notes.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('name,label\nsite_a,Site A\n'),
    })
    await expect(page.getByTestId('attachments-dialog')).toContainText('notes.csv')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('save-indicator')).toContainText('All changes saved')

    // Export the ZIP · XForm XML + attachments bundle.
    await page.getByTestId('export-button').getByRole('button').last().click()
    const [zipDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'ZIP · XForm XML + attachments' }).click(),
    ])
    expect(zipDownload.suggestedFilename()).toMatch(/-xform\.zip$/)
    const zipPath = testInfo.outputPath('cascade-bundle.zip')
    await zipDownload.saveAs(zipPath)

    // Delete the form from the library.
    await page.goto('/#/')
    await page.getByTestId('form-card-cascade_test').getByTestId('form-card-menu').click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByTestId('form-card-cascade_test')).toHaveCount(0)

    // Import the downloaded ZIP bundle back through the Import form dialog.
    await page.getByTestId('import-form').click()
    await page.getByTestId('import-file-input').setInputFiles(zipPath)
    await expect(page.getByTestId('import-report')).toContainText('No problems found')
    await page.getByTestId('import-confirm').click()
    await expect(page.getByTestId('editor')).toBeVisible()

    // The attachment came back with the form.
    await page.getByTestId('form-menu').click()
    await page.getByRole('menuitem', { name: 'Attachments' }).click()
    await expect(page.getByTestId('attachments-dialog')).toContainText('notes.csv')
  })
})
