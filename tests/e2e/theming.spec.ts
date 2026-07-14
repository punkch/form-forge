import { expect, test, type Page } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

/** The persisted ui-store blob the app (and the index.html no-FOUC script)
 * read on boot. A partial blob is fine: the store fills the rest from
 * defaults after the STORAGE_VERSION check passes. */
const seedTheme = (page: Page, theme: 'light' | 'dark' | 'system', accent = 'blue'): Promise<void> =>
  page.addInitScript(
    ([t, a]) => {
      localStorage.setItem('odk-builder:ui:v1', JSON.stringify({ version: 1, theme: t, accent: a }))
    },
    [theme, accent] as const
  )

/** Resolves a CSS expression (e.g. `var(--p-primary-500)`) to a concrete
 * `rgb(...)` string by letting the browser fully resolve the custom-property
 * chain — reading the raw custom property can return an unresolved `var()`. */
const resolveColor = (page: Page, cssExpr: string): Promise<string> =>
  page.evaluate((expr) => {
    const probe = document.createElement('div')
    probe.style.color = expr
    document.body.appendChild(probe)
    const rgb = getComputedStyle(probe).color
    probe.remove()
    return rgb
  }, cssExpr)

/** `[r, g, b]` from an `rgb(...)`/`rgba(...)` string. */
const channels = (rgb: string): number[] => (rgb.match(/\d+/g) ?? []).slice(0, 3).map(Number)

/** Mean channel value — a cheap "is this dark?" probe. White ≈ 255, the dark
 * slate surface (#0f172a) ≈ 27. */
const brightness = (rgb: string): number => {
  const [r, g, b] = channels(rgb)
  return (r + g + b) / 3
}

test.describe('theming', () => {
  // The whole design exists to survive the web-forms child app mounting. This
  // is the regression that guards it: a dark builder must STAY dark once the
  // live preview (a second PrimeVue app on the same document) is mounted.
  test('the live preview mounting never clobbers the dark builder theme', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await seedTheme(page, 'dark')

    await createForm(page, 'Clobber Guard')
    await addQuestion(page, 'text')
    await addQuestion(page, 'select_one')

    // Baseline: dark before the preview exists.
    await expect(page.locator('html')).toHaveAttribute('data-ff-theme', 'dark')
    expect(brightness(await resolveColor(page, 'var(--odk-base-background-color)'))).toBeLessThan(80)

    // Mount the real engine (the large chunk needs a generous first load).
    await page.getByTestId('preview-button').click()
    const preview = page.getByTestId('preview-host')
    await expect(preview.getByRole('heading', { name: 'Clobber Guard' })).toBeVisible({ timeout: 30_000 })

    // The attribute must survive the child app's install...
    await expect(page.locator('html')).toHaveAttribute('data-ff-theme', 'dark')
    // ...and so must the resolved dark surface tokens on :root (the exact thing
    // the preview runtime could otherwise overwrite with its light preset).
    expect(brightness(await resolveColor(page, 'var(--odk-base-background-color)'))).toBeLessThan(80)
    expect(brightness(await resolveColor(page, 'var(--p-surface-900)'))).toBeLessThan(80)

    // Readability regression: web-forms renders question labels inside PrimeVue
    // Card/Panel whose colour tokens don't invert under darkModeSelector:false;
    // builder-dark.css remaps them so preview text is LIGHT on dark, not the
    // dark-on-dark it would otherwise be.
    const labelColor = await preview.locator('.odk-form label').first().evaluate((el) => getComputedStyle(el).color)
    expect(brightness(labelColor)).toBeGreaterThan(150)
  })

  test('a chosen dark scheme persists across a reload', async ({ page }) => {
    // Go through the real header toggle so the store's persist path runs.
    await createForm(page, 'Persist Flow')
    const toggle = page.getByTestId('theme-toggle')

    // The toggle cycles system → light → dark. From a fresh (unseeded) context
    // the preference starts at `system`, so two clicks land on an explicit dark
    // preference that resolves to dark regardless of the OS colour scheme.
    await toggle.click()
    await toggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-ff-theme', 'dark')

    await page.reload()
    // The inline bootstrap re-applies it from localStorage on the next boot.
    await expect(page.locator('html')).toHaveAttribute('data-ff-theme', 'dark')
  })

  test('a dark preference paints with no light flash on first load', async ({ page }) => {
    await seedTheme(page, 'dark')

    // domcontentloaded fires after the in-<head> bootstrap script has run, so
    // the attribute is already stamped before any application/Vue code mounts.
    await page.goto('/#/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('html')).toHaveAttribute('data-ff-theme', 'dark')
  })

  test('picking an accent swatch recolours the primary scale', async ({ page }) => {
    await page.goto('/#/')
    await page.getByTestId('settings-gear').click()
    await expect(page.getByTestId('settings-view')).toBeVisible()

    await page.getByTestId('accent-swatch-amber').click()

    await expect(page.locator('html')).toHaveAttribute('data-ff-accent', 'amber')
    // Amber's --p-primary-500 is #f59e0b.
    expect(channels(await resolveColor(page, 'var(--p-primary-500)'))).toEqual([245, 158, 11])
  })
})
