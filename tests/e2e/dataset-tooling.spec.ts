import { expect, test } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

/** villages-style fixture with enough rows to trip the 500-row preview cap. */
const villagesCsv = (rows = 520): Buffer => {
  const lines = ['name,label,district']
  for (let i = 1; i <= rows; i++) lines.push(`v${i},Village ${i},d${i % 7}`)
  return Buffer.from(lines.join('\n') + '\n')
}

test.describe('dataset tooling: column dropdowns, validation, preview', () => {
  test('columns drive the value/label params, typos warn, view file renders the table', async ({ page }) => {
    await createForm(page, 'Dataset Tooling')
    await addQuestion(page, 'select_one_from_file')
    await expect(page.getByTestId('node-card-select_one_from_file')).toBeVisible()

    // Attach a villages-style CSV straight from the property panel.
    await page.getByTestId('prop-itemset-upload-input').setInputFiles({
      name: 'villages.csv',
      mimeType: 'text/csv',
      buffer: villagesCsv(),
    })
    await expect(page.getByTestId('prop-itemset-status')).toHaveAttribute('data-state', 'attached')

    // Once the columns are parsed, the value param becomes an editable Select
    // listing the file's actual columns.
    const valueParam = page.getByTestId('prop-param-value')
    await expect(valueParam).toHaveClass(/p-select/)
    await valueParam.locator('.p-select-dropdown').click()
    await expect(page.locator('.p-select-option')).toHaveText(['name', 'label', 'district'])
    await page.locator('.p-select-option', { hasText: 'district' }).click()

    // No dataset warnings while the chosen columns exist.
    await page.getByTestId('problems-button').click()
    await expect(page.getByTestId('problems-list')).toContainText('No problems found')
    await page.keyboard.press('Escape')

    // Typing a misspelled column raises a warning pointing at the question.
    await valueParam.locator('input').fill('distrct')
    await page.getByTestId('problems-button').click()
    await expect(page.getByTestId('problems-list')).toContainText('The value column "distrct" does not exist in "villages.csv"')
    // Clicking the problem row selects the offending node.
    await page.getByText('The value column "distrct" does not exist', { exact: false }).click()
    await expect(page.getByTestId('node-card-select_one_from_file')).toHaveClass(/selected/)

    // View file opens the preview table, truncated to the first 500 rows.
    await page.getByTestId('prop-itemset-view').click()
    await expect(page.getByTestId('dataset-preview-dialog')).toBeVisible()
    await expect(page.getByTestId('dataset-preview-truncated')).toContainText('500')
    const table = page.getByTestId('dataset-preview-table')
    await expect(table).toContainText('district')
    await expect(table).toContainText('Village 1')
    await page.keyboard.press('Escape')
  })

  test('attachments dialog offers per-row preview: xml as raw text, images as an img', async ({ page }) => {
    await createForm(page, 'Dataset Attachments')
    await addQuestion(page, 'text')

    await page.getByTestId('form-menu').click()
    await page.getByRole('menuitem', { name: 'Attachments' }).click()
    await page.getByTestId('attachment-file-input').setInputFiles({
      name: 'lookup.xml',
      mimeType: 'text/xml',
      buffer: Buffer.from('<root><item id="a"/></root>'),
    })
    await expect(page.getByTestId('attachments-dialog')).toContainText('lookup.xml')

    await page.getByTestId('attachment-view').click()
    await expect(page.getByTestId('dataset-preview-dialog')).toBeVisible()
    await expect(page.getByTestId('dataset-preview-raw')).toContainText('<root><item id="a"/></root>')
    await page.keyboard.press('Escape')

    // An image attachment gets the same eye button and previews as an <img>.
    await page.getByTestId('form-menu').click()
    await page.getByRole('menuitem', { name: 'Attachments' }).click()
    await page.getByTestId('attachment-file-input').setInputFiles({
      name: 'pixel.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'),
    })
    // Two rows now carry eye buttons — pick the image's via its aria-label.
    await page.getByRole('button', { name: 'View pixel.png' }).click()
    await expect(page.getByTestId('dataset-preview-dialog')).toBeVisible()
    await expect(page.getByTestId('dataset-preview-image')).toBeVisible()
    await expect(page.getByTestId('dataset-preview-image')).toHaveAttribute('src', /^blob:/)
  })
})
