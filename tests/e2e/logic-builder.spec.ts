import { expect, test, type Page } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

const ACCEPTANCE = "${age} >= 18 and (selected(${type}, 'refugee') or selected(${type}, 'idp'))"

/** Picks an option in a PrimeVue Select opened from `testid`. */
const pickOption = async (page: Page, testid: string, option: string): Promise<void> => {
  await page.getByTestId(testid).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test.describe('visual logic builder', () => {
  test('builds the acceptance expression visually, survives reload, and drives skip logic in the preview', async ({ page }) => {
    await createForm(page, 'Logic Flow')

    // A small form: age (integer), type (select_one refugee/idp), adult_q (text).
    await addQuestion(page, 'integer')
    await page.getByTestId('prop-name').fill('age')
    await page.getByTestId('prop-label').fill('Your age')

    await addQuestion(page, 'select_one')
    await page.getByTestId('prop-name').fill('type')
    await page.getByTestId('prop-label').fill('Status')
    await page.getByTestId('choice-name-0').fill('refugee')
    await page.getByTestId('choice-label-0').fill('Refugee')
    await page.getByTestId('choice-name-1').fill('idp')
    await page.getByTestId('choice-label-1').fill('IDP')

    await addQuestion(page, 'text')
    await page.getByTestId('prop-name').fill('adult_q')
    await page.getByTestId('prop-label').fill('Adult question')

    // Build: age >= 18 AND (type includes refugee OR type includes idp).
    await page.getByTestId('logic-mode-relevant').getByText('Visual').click()
    await page.getByTestId('cond-add-relevant').click()
    await expect(page.getByTestId('cond-relevant-0')).toBeVisible()
    await pickOption(page, 'cond-relevant-0-op', '>=')
    // PrimeVue InputNumber builds its value from key events, so type for real.
    const ageValue = page.getByTestId('cond-relevant-0-value').locator('input')
    await ageValue.click()
    await ageValue.press('ControlOrMeta+a')
    await ageValue.pressSequentially('18')
    await ageValue.press('Tab')

    await page.getByTestId('cond-add-group-relevant').click()
    await expect(page.getByTestId('cond-relevant-1-0')).toBeVisible()
    await pickOption(page, 'cond-relevant-1-0-field', 'Status (type)')
    await pickOption(page, 'cond-relevant-1-0-op', 'includes')
    await pickOption(page, 'cond-relevant-1-0-value', 'Refugee (refugee)')

    await page.getByTestId('cond-add-relevant-1').click()
    await expect(page.getByTestId('cond-relevant-1-1')).toBeVisible()
    await pickOption(page, 'cond-relevant-1-1-field', 'Status (type)')
    await pickOption(page, 'cond-relevant-1-1-op', 'includes')
    await pickOption(page, 'cond-relevant-1-1-value', 'IDP (idp)')
    await page.getByTestId('cond-join-relevant-1').getByText('Any').click()

    // Raw view shows the canonical serialization; toggling back loses nothing.
    await page.getByTestId('logic-mode-relevant').getByText('Raw').click()
    await expect(page.getByTestId('expr-relevant')).toHaveValue(ACCEPTANCE)
    await page.getByTestId('logic-mode-relevant').getByText('Visual').click()
    await expect(page.getByTestId('cond-relevant-0')).toBeVisible()

    // Reopen after reload: still visual, still identical.
    await expect(page.getByTestId('save-indicator')).toContainText('All changes saved')
    await page.reload()
    await page.getByTestId('node-card-adult_q').click()
    await expect(page.getByTestId('logic-visual-relevant')).toBeVisible()
    await expect(page.getByTestId('cond-relevant-0')).toBeVisible()
    await expect(page.getByTestId('cond-group-relevant-1')).toBeVisible()
    await page.getByTestId('logic-mode-relevant').getByText('Raw').click()
    await expect(page.getByTestId('expr-relevant')).toHaveValue(ACCEPTANCE)

    // Live preview: the question only appears for age >= 18 AND a matching type.
    await page.getByTestId('preview-button').click()
    const preview = page.getByTestId('preview-host')
    await expect(preview.getByRole('heading', { name: 'Logic Flow' })).toBeVisible({ timeout: 30_000 })
    await expect(preview.getByText('Adult question')).toHaveCount(0)

    // The integer widget builds its value from key events, so type for real.
    const ageInput = preview.locator('input').first()
    const typeAge = async (value: string): Promise<void> => {
      await ageInput.click()
      await ageInput.press('ControlOrMeta+a')
      await ageInput.pressSequentially(value)
      await ageInput.press('Tab')
    }
    await typeAge('25')
    await preview.getByText('Refugee').click()
    await expect(preview.getByText('Adult question')).toBeVisible({ timeout: 10_000 })

    // Under 18 → hidden again.
    await typeAge('15')
    await expect(preview.getByText('Adult question')).toHaveCount(0, { timeout: 10_000 })
  })
})
