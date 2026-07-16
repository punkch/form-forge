import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

/** The shipped fr catalog, read straight from disk: Playwright's Node ESM
 * loader requires `type: json` import attributes for JSON modules, so a
 * plain `import('@/i18n/locales/fr')` fails at runtime here. */
const frAppSettings = (
  JSON.parse(
    readFileSync(
      join(fileURLToPath(new URL('../..', import.meta.url)), 'src/i18n/locales/fr/appSettings.json'),
      'utf8'
    )
  ) as { appSettings: { title: string } }
).appSettings

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

  test.describe('language switching', () => {
    test('switches to French, persists a known shell string, survives reload', async ({ page }) => {
      await page.goto('/#/')
      await page.getByTestId('settings-gear').click()
      await page.getByTestId('settings-language-select').click()
      await page.getByRole('option', { name: 'Français', exact: true }).click()

      // Pick one always-visible, uniquely-identifying shell/appSettings
      // string (the Settings page heading) and assert the rendered text
      // equals the catalog's own French value.
      await expect(page.getByTestId('settings-view').locator('h1'))
        .toHaveText(frAppSettings.title)

      await page.reload()
      await expect(page.getByTestId('settings-language-select')).toContainText('Français')
      await expect(page.getByTestId('settings-view').locator('h1'))
        .toHaveText(frAppSettings.title)
    })
  })

  test.describe('first-run locale detection', () => {
    test.use({ locale: 'fr-CA' })

    test('a fresh session with no stored preference matches navigator.language to fr', async ({ page }) => {
      await page.goto('/#/')
      await page.getByTestId('settings-gear').click()
      await expect(page.getByTestId('settings-language-select')).toContainText('Français')
      await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
    })
  })
})
