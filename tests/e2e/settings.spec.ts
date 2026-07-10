import { expect, test } from '@playwright/test'

test.describe('app settings', () => {
  test('gear routes to settings; sections render; back returns to the library', async ({ page }) => {
    await page.goto('/#/')
    await page.getByTestId('settings-gear').click()
    await expect(page.getByTestId('settings-view')).toBeVisible()
    await expect(page).toHaveURL(/#\/settings$/)

    // Workspace section: an empty library disables the export backup.
    await expect(page.getByTestId('settings-export-workspace')).toBeDisabled()
    await expect(page.getByTestId('settings-import-workspace')).toBeEnabled()

    // Language section: the shipped English catalog is the selected option.
    await expect(page.getByTestId('settings-language-select')).toContainText('English')

    // About: a version line and a storage-persistence line.
    await expect(page.getByTestId('settings-about-version'))
      .toContainText(/Form Forge for ODK v\d+\.\d+\.\d+/)
    await expect(page.getByTestId('settings-about-storage')).toContainText('Storage:')

    // Back returns to the library.
    await page.getByTestId('settings-back').click()
    await expect(page.getByTestId('new-form')).toBeVisible()
    await expect(page).toHaveURL(/#\/$/)
  })
})
