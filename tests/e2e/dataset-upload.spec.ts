import { expect, test } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

test.describe('dataset upload from the property panel', () => {
  test('select_one_from_file: upload clears the problem and feeds the preview', async ({ page }) => {
    await createForm(page, 'Dataset Upload')
    await addQuestion(page, 'select_one_from_file')
    await expect(page.getByTestId('node-card-select_one_from_file')).toBeVisible()

    // A fresh from-file question has no attached file: the validator reports it.
    await page.getByTestId('problems-button').click()
    await expect(page.getByTestId('problems-list'))
      .toContainText('need an attached choices file', { timeout: 5_000 })
    await page.keyboard.press('Escape')

    // Upload straight from the property panel; the file's own name is adopted.
    await expect(page.getByTestId('prop-itemset-status')).toHaveAttribute('data-state', 'none')
    await page.getByTestId('prop-itemset-upload-input').setInputFiles({
      name: 'fruits.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('name,label\napple,Apple\nbanana,Banana\n'),
    })
    await expect(page.getByTestId('prop-itemset-file')).toHaveValue('fruits.csv')
    await expect(page.getByTestId('prop-itemset-status')).toHaveAttribute('data-state', 'attached')

    // Validation re-runs and the problem clears.
    await page.getByTestId('problems-button').click()
    await expect(page.getByTestId('problems-list')).toContainText('No problems found', { timeout: 5_000 })
    await page.keyboard.press('Escape')

    // The live preview resolves the attachment and renders the CSV's labels.
    await page.getByTestId('preview-button').click()
    const preview = page.getByTestId('preview-host')
    // The engine chunk is large; allow a generous first load.
    await expect(preview.getByText('Apple')).toBeVisible({ timeout: 30_000 })
    await expect(preview.getByText('Banana')).toBeVisible()
  })

  test('csv-external: pulldata() reads the uploaded CSV in the preview', async ({ page }) => {
    await createForm(page, 'Pulldata Flow')

    // External CSV dataset; uploading adopts the file's name → instance('fuel').
    await addQuestion(page, 'csv-external')
    await expect(page.getByTestId('node-card-csv_external')).toBeVisible()
    await expect(page.getByTestId('prop-itemset-status')).toHaveAttribute('data-state', 'missing')
    await page.getByTestId('prop-itemset-upload-input').setInputFiles({
      name: 'fuel.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('code,price\ndiesel,42\npetrol,55\n'),
    })
    await expect(page.getByTestId('prop-itemset-status')).toHaveAttribute('data-state', 'attached')

    // A calculate pulling from the CSV, surfaced through a note's output.
    await addQuestion(page, 'calculate')
    await expect(page.getByTestId('node-card-calculate')).toBeVisible()
    await page.getByTestId('expr-calculation').fill("pulldata('fuel', 'price', 'code', 'diesel')")
    await addQuestion(page, 'note')
    await expect(page.getByTestId('node-card-note')).toBeVisible()
    await page.getByTestId('prop-label').fill('Diesel costs ${calculate}')

    await page.getByTestId('preview-button').click()
    const preview = page.getByTestId('preview-host')
    await expect(preview.getByText('Diesel costs 42')).toBeVisible({ timeout: 30_000 })
  })
})
