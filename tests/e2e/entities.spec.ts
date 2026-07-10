import { readFileSync } from 'node:fs'

import { expect, test, type Page } from '@playwright/test'

import { readXlsForm } from '../../src/core/xlsform/reader'
import type { QuestionNode } from '../../src/core/model/types'
import { addQuestion, createForm } from './helpers'

const householdsCsv = Buffer.from(
  'name,label,__version\nuuid-1,House A,1\nuuid-2,House B,1\n'
)

const openEntitiesTab = async (page: Page): Promise<void> => {
  await page.getByTestId('editor-more').click()
  await page.getByRole('menuitem', { name: 'Form settings' }).click()
  await expect(page.getByTestId('settings-dialog')).toBeVisible()
  await page.getByTestId('settings-tab-entities').click()
}

test.describe('entities: declaration, save_to, follow-up wizard, export', () => {
  test('declare a list, map save_to (reserved name caught), export the entities sheet', async ({ page }) => {
    await createForm(page, 'Household Registration')
    await addQuestion(page, 'text')

    // Declare the entity list in settings → Entities.
    await openEntitiesTab(page)
    await page.getByTestId('entity-declare').click()
    await page.getByTestId('entity-dataset-name').fill('households')
    await page.getByTestId('expr-entityLabel').fill('${text}')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('settings-dialog')).toBeHidden()

    // A reserved save_to name surfaces inline and in Problems.
    await page.getByTestId('node-card-text').click()
    await page.getByTestId('prop-save-to').fill('label')
    await expect(page.getByTestId('save-to-issue')).toContainText('save_to')
    await page.getByTestId('problems-button').click()
    await expect(page.getByTestId('problems-list')).toContainText('save_to must not be')
    await page.keyboard.press('Escape')

    // Fix it; the settings overview table now maps question → property.
    await page.getByTestId('prop-save-to').fill('household_name')
    await expect(page.getByTestId('save-to-issue')).toHaveCount(0)
    await openEntitiesTab(page)
    const row = page.getByTestId('entity-save-to-row')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('text')
    await expect(row).toContainText('household_name')

    // Clicking the row closes the dialog and selects the question.
    await row.getByRole('button').click()
    await expect(page.getByTestId('settings-dialog')).toBeHidden()
    await expect(page.getByTestId('node-card-text')).toHaveClass(/selected/)

    // Export XLSForm and read it back with the native reader (node-side).
    await page.getByTestId('export-button').getByRole('button').last().click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'XLSForm (.xlsx)' }).click(),
    ])
    const bytes = readFileSync(await download.path())
    const { document, issues } = await readXlsForm(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
    )
    expect(issues.filter((i) => i.severity === 'error')).toEqual([])
    expect(document.entities).toEqual({ datasetName: 'households', label: '${text}' })
    const question = document.children.find((n) => n.name === 'text') as QuestionNode
    expect(question.saveTo).toBe('household_name')
  })

  test('follow-up wizard wires a consuming select + entity_id; preview survives', async ({ page }) => {
    await createForm(page, 'Household Follow-up')
    await addQuestion(page, 'text')

    await openEntitiesTab(page)
    await page.getByTestId('entity-declare').click()
    await page.getByTestId('entity-dataset-name').fill('households')
    await page.getByTestId('entity-follow-up').click()

    // The wizard fills entity_id/update_if and reports the created question.
    await expect(page.getByTestId('entity-follow-up-done')).toContainText('households')
    await expect(page.getByTestId('expr-entityId')).toHaveValue('${households}')
    await expect(page.getByTestId('expr-updateIf')).toHaveValue('true()')
    await page.keyboard.press('Escape')

    // The consuming question landed at the top of the form; attach its list.
    const card = page.getByTestId('node-card-households')
    await expect(card).toBeVisible()
    await card.click()
    await page.getByTestId('prop-itemset-upload-input').setInputFiles({
      name: 'households.csv',
      mimeType: 'text/csv',
      buffer: householdsCsv,
    })
    await expect(page.getByTestId('prop-itemset-status')).toHaveAttribute('data-state', 'attached')

    // Preview must not crash on the entity-update form: either it renders
    // (GO) or web-forms reports a contained error (DEGRADED) — never a dead
    // page. See docs/specs/2026-07-10-1000-entities-advanced/shape.md.
    await page.getByTestId('preview-button').click()
    const preview = page.getByTestId('preview-host')
    const heading = preview.getByRole('heading', { name: 'Household Follow-up' })
    const containedError = page
      .getByTestId('preview-error-state')
      .or(page.getByTestId('preview-engine-error'))
    await expect(heading.or(containedError).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('editor')).toBeVisible()

    const rendered = await heading.isVisible()
    const optionShown = rendered
      ? await preview.getByText('House A').first()
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => true, () => false)
      : false
    console.log(`[entities spike] preview rendered=${rendered} entityListOptions=${optionShown}`)

    // The editor stays fully usable after whatever the engine did.
    await page.getByTestId('node-card-text').click()
    await page.getByTestId('prop-label').fill('Still alive?')
    await expect(page.getByTestId('prop-label')).toHaveValue('Still alive?')
  })
})
