import { expect, test } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

test.describe('workspace archive', () => {
  test('export → wipe → import restores forms and attachments', async ({ page }, testInfo) => {
    // Form 1: a question plus a CSV attachment.
    await createForm(page, 'Water Survey')
    await addQuestion(page, 'text')
    await page.getByTestId('editor-more').click()
    await page.getByRole('menuitem', { name: 'Attachments' }).click()
    await page.getByTestId('attachment-file-input').setInputFiles({
      name: 'sites.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('name,label\nsite_a,Site A\nsite_b,Site B\n'),
    })
    await expect(page.getByTestId('attachments-dialog')).toContainText('sites.csv')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('save-indicator')).toContainText('All changes saved')

    // Form 2: just a question.
    await createForm(page, 'Household Census')
    await addQuestion(page, 'integer')
    await expect(page.getByTestId('save-indicator')).toContainText('All changes saved')

    // Export the whole workspace from the settings page.
    await page.goto('/#/')
    await expect(page.getByTestId('form-card-water_survey')).toBeVisible()
    await page.getByTestId('settings-gear').click()
    await expect(page.getByTestId('settings-view')).toBeVisible()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('settings-export-workspace').click(),
    ])
    expect(download.suggestedFilename())
      .toMatch(/^formforge-workspace-\d{4}-\d{2}-\d{2}\.formforge\.zip$/)
    const archivePath = testInfo.outputPath('workspace.formforge.zip')
    await download.saveAs(archivePath)
    await page.getByTestId('settings-back').click()

    // Wipe local storage and reload — the library must be empty.
    await page.evaluate(async () => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('form-forge')
        request.onsuccess = () => { resolve() }
        request.onerror = () => { reject(new Error('deleteDatabase failed')) }
        // Dexie closes its connection on versionchange; if that is missed,
        // resolve anyway — the reload below releases the last handle.
        request.onblocked = () => { resolve() }
      })
    })
    await page.reload()
    await expect(page.getByTestId('library-empty')).toBeVisible()

    // Import the archive back through the settings page's workspace dialog.
    await page.getByTestId('settings-gear').click()
    await expect(page.getByTestId('settings-view')).toBeVisible()
    await page.getByTestId('settings-import-workspace').click()
    await expect(page.getByTestId('workspace-archive-dialog')).toBeVisible()
    await page.getByTestId('workspace-archive-file-input').setInputFiles(archivePath)
    const report = page.getByTestId('workspace-archive-report')
    await expect(report).toContainText('2 forms found')
    await expect(report).toContainText('No problems found')
    await expect(report).toContainText('Water Survey')
    await expect(report).toContainText('Household Census')
    await expect(page.getByTestId('workspace-archive-issues')).toHaveCount(0)
    await page.getByTestId('workspace-archive-import').click()

    // Success toast, no warnings, both forms back with their question counts.
    await expect(page.getByText('2 forms imported')).toBeVisible()
    await expect(page.getByText('Import warning')).toHaveCount(0)
    await page.getByTestId('settings-back').click()
    await expect(page.getByTestId('form-card-water_survey')).toContainText('1 question')
    await expect(page.getByTestId('form-card-household_census')).toContainText('1 question')

    // The attachment came back with its form.
    await page.getByTestId('form-card-water_survey').getByText('Water Survey').click()
    await expect(page.getByTestId('editor')).toBeVisible()
    await page.getByTestId('editor-more').click()
    await page.getByRole('menuitem', { name: 'Attachments' }).click()
    await expect(page.getByTestId('attachments-dialog')).toContainText('sites.csv')
    await expect(page.getByTestId('attachments-dialog')).toContainText('text/csv')
  })

  test('a single form exports as <formId>.formforge.zip from the card menu', async ({ page }) => {
    await createForm(page, 'Solo Form')
    await addQuestion(page, 'text')
    await expect(page.getByTestId('save-indicator')).toContainText('All changes saved')

    await page.goto('/#/')
    await page.getByTestId('form-card-solo_form').getByTestId('form-card-menu').click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Export archive' }).click(),
    ])
    expect(download.suggestedFilename()).toBe('solo_form.formforge.zip')
  })
})
