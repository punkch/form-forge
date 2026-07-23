import { expect, test, type Page } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

/** Ctrl/Cmd+Click toggles a card into the selection without collapsing it. */
const ctrlClick = async (page: Page, testId: string): Promise<void> => {
  await page.getByTestId(testId).click({ modifiers: ['Control'] })
}

/** Visible node cards in DOM/document order — the same selector the app
 * itself uses for shift-range selection and roving keyboard focus
 * (TreeNodeCard.vue's `.node-card[data-node-id]` queries). */
const nodeCardIds = (page: Page): Promise<string[]> =>
  page.locator('.node-card[data-node-id]').evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-testid') ?? ''))

test.describe('canvas multi-select & clipboard', () => {
  test('ctrl-click selects two cards, toolbar cut/paste relocate them, and undo reverts the paste', async ({ page }) => {
    await createForm(page, 'Clipboard Reorder')
    await addQuestion(page, 'text')
    await addQuestion(page, 'integer')
    await addQuestion(page, 'note')
    await expect.poll(() => nodeCardIds(page)).toEqual([
      'node-card-text', 'node-card-integer', 'node-card-note',
    ])

    // Ctrl-click two non-adjacent cards into one selection.
    await page.getByTestId('node-card-text').click()
    await ctrlClick(page, 'node-card-note')
    await expect(page.getByTestId('selection-count')).toContainText('2 selected')

    // Cut removes both, leaving only the untouched middle card.
    await page.getByTestId('toolbar-cut').click()
    await expect.poll(() => nodeCardIds(page)).toEqual(['node-card-integer'])

    // Select the remaining card, then paste: the cut pair lands right after
    // it (paste targets "right after the current selection").
    await page.getByTestId('node-card-integer').click()
    await page.getByTestId('toolbar-paste').click()
    await expect.poll(() => nodeCardIds(page)).toEqual([
      'node-card-integer', 'node-card-text', 'node-card-note',
    ])

    // Cut and paste are two separate undo entries (one gesture = one entry
    // each) — a single Ctrl+Z fully reverts the paste as one atomic step,
    // back to the post-cut, pre-paste layout.
    await page.keyboard.press('Control+z')
    await expect.poll(() => nodeCardIds(page)).toEqual(['node-card-integer'])
  })

  test('cut in one form and paste into another via the cross-form clipboard buffer', async ({ page }) => {
    await createForm(page, 'Clip Source')
    await addQuestion(page, 'text')
    await addQuestion(page, 'integer')

    await page.getByTestId('node-card-text').click()
    await ctrlClick(page, 'node-card-integer')
    await expect(page.getByTestId('selection-count')).toContainText('2 selected')

    await page.getByTestId('toolbar-cut').click()
    await expect(page.locator('.node-card[data-node-id]')).toHaveCount(0)

    await page.getByTestId('back-to-library').click()
    await createForm(page, 'Clip Target')

    await expect(page.getByTestId('toolbar-paste')).toBeEnabled()
    await page.getByTestId('toolbar-paste').click()
    await expect.poll(() => nodeCardIds(page)).toEqual([
      'node-card-text', 'node-card-integer',
    ])
  })

  test('insert from template via the gear menu appends its questions to the open form', async ({ page }) => {
    await createForm(page, 'Insert Template Flow')
    await addQuestion(page, 'text')
    await expect(page.getByTestId('node-card-text')).toBeVisible()

    await page.getByTestId('form-menu').click()
    await page.getByRole('menuitem', { name: 'Insert from template' }).click()
    await expect(page.getByTestId('insert-template-dialog')).toBeVisible()

    await page.getByTestId('insert-template-card-household-survey').click()
    await expect(page.getByTestId('insert-template-dialog')).toBeHidden()

    // The pre-existing question survives, plus the template's 13 questions +
    // 1 repeat container (14 cards total, per the templates.spec baseline).
    await expect(page.getByTestId('node-card-text')).toBeVisible()
    await expect(page.getByTestId('node-card-interview_date')).toBeVisible()
    await expect(page.locator('.node-card[data-node-id]')).toHaveCount(15)
  })

  test('multi-move: Alt+ArrowDown moves the whole selection as one block, one undo restores it', async ({ page }) => {
    await createForm(page, 'Multi Move Flow')
    await addQuestion(page, 'text')
    await addQuestion(page, 'integer')
    await addQuestion(page, 'note')
    await expect.poll(() => nodeCardIds(page)).toEqual([
      'node-card-text', 'node-card-integer', 'node-card-note',
    ])

    // Select two adjacent cards, then move the block down from the focused
    // (ctrl-clicked) card — the whole selection travels together.
    await page.getByTestId('node-card-text').click()
    await ctrlClick(page, 'node-card-integer')
    await page.keyboard.press('Alt+ArrowDown')

    await expect.poll(() => nodeCardIds(page)).toEqual([
      'node-card-note', 'node-card-text', 'node-card-integer',
    ])

    // Single-mutate move: one Ctrl+Z fully restores the original order.
    await page.keyboard.press('Control+z')
    await expect.poll(() => nodeCardIds(page)).toEqual([
      'node-card-text', 'node-card-integer', 'node-card-note',
    ])
  })

  test('Ctrl+A selects every top-level question and Escape clears the selection', async ({ page }) => {
    await createForm(page, 'Select All')
    await addQuestion(page, 'text')
    await addQuestion(page, 'integer')
    await addQuestion(page, 'note')

    // Focus a card so the selection shortcuts fire from inside the canvas
    // (they're scoped to canvas-panel/body targets by design).
    await page.getByTestId('node-card-text').click()
    await page.keyboard.press('Control+a')
    await expect(page.getByTestId('selection-count')).toContainText('3 selected')

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('selection-count')).toBeHidden()
    await expect(page.getByTestId('toolbar-cut')).toBeDisabled()
  })
})
