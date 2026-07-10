import { expect, test } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

test.describe('in-app help', () => {
  test('header Help opens the searchable reference and a type entry', async ({ page }) => {
    await createForm(page, 'Help smoke')

    await page.getByTestId('help-button').click()
    await expect(page.getByTestId('help-reference')).toBeVisible()

    await page.getByTestId('help-search').fill('select')
    await expect(page.getByTestId('help-ref-item-select_one')).toBeVisible()
    await expect(page.getByTestId('help-ref-item-date')).toHaveCount(0)

    await page.getByTestId('help-ref-item-select_one').click()
    await expect(page.getByTestId('help-ref-detail')).toBeVisible()
    await expect(page.getByTestId('help-appearances')).toContainText('minimal')
    await expect(page.getByTestId('help-appearances')).toContainText('Collect')
    await expect(page.getByTestId('help-read-more')).toHaveAttribute(
      'href',
      'https://docs.getodk.org/form-question-types/#single-select-widget'
    )

    await page.getByTestId('help-ref-back').click()
    await expect(page.getByTestId('help-search')).toBeVisible()
  })

  test('palette info icon opens the type help drawer', async ({ page }) => {
    await createForm(page, 'Help palette')

    await page.getByTestId('palette-item-text').hover()
    await page.getByTestId('palette-item-info-text').click()

    await expect(page.getByTestId('help-drawer')).toBeVisible()
    await expect(page.getByTestId('help-drawer')).toContainText('Text')
    await expect(page.getByTestId('help-content')).toContainText('free-form text')
  })

  test('property panel header opens help for the selected type', async ({ page }) => {
    await createForm(page, 'Help properties')
    await addQuestion(page, 'integer')

    await page.getByTestId('property-help').click()
    await expect(page.getByTestId('help-drawer')).toBeVisible()
    await expect(page.getByTestId('help-drawer')).toContainText('Integer')
    await expect(page.getByTestId('help-appearances')).toContainText('counter')
  })
})
