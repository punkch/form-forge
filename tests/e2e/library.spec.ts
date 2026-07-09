import { expect, test } from '@playwright/test'

import { createForm } from './helpers'

test.describe('form library', () => {
  test('create, rename, duplicate, delete and persist across reload', async ({ page }) => {
    await createForm(page, 'Library Flow')
    await page.getByTestId('back-to-library').click()

    const card = page.getByTestId('form-card-library_flow')
    await expect(card).toBeVisible()

    // Survives a full reload (IndexedDB persistence).
    await page.reload()
    await expect(card).toBeVisible()

    // Rename
    await card.getByTestId('form-card-menu').click()
    await page.getByRole('menuitem', { name: 'Rename' }).click()
    await page.getByTestId('rename-title').fill('Library Flow 2')
    await page.getByRole('button', { name: 'Rename', exact: true }).click()
    await expect(page.getByText('Library Flow 2')).toBeVisible()

    // Duplicate
    await card.getByTestId('form-card-menu').click()
    await page.getByRole('menuitem', { name: 'Duplicate' }).click()
    await expect(page.getByTestId('form-card-library_flow_copy')).toBeVisible()

    // Delete the copy (confirmation dialog)
    await page.getByTestId('form-card-library_flow_copy').getByTestId('form-card-menu').click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByTestId('form-card-library_flow_copy')).toHaveCount(0)
  })
})
