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

    // ZIP export
    await page.getByTestId('export-button').getByRole('button').last().click()
    const [zipDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'ZIP with attachments' }).click(),
    ])
    expect(zipDownload.suggestedFilename()).toMatch(/\.zip$/)
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
})
