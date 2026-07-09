import { expect, type Page } from '@playwright/test'

/** Creates a form from the library and lands in the editor. */
export const createForm = async (page: Page, title: string): Promise<void> => {
  await page.goto('/#/')
  await page.getByTestId('new-form').click()
  await page.getByTestId('new-form-title').fill(title)
  await page.getByTestId('new-form-create').click()
  await expect(page.getByTestId('editor')).toBeVisible()
}

/** Adds a question by clicking its palette entry; returns nothing — the new
 * node is selected automatically. */
export const addQuestion = async (page: Page, paletteType: string): Promise<void> => {
  await page.getByTestId(`palette-item-${paletteType}`).click()
}
