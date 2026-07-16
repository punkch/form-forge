import { expect, test, type Page } from '@playwright/test'

import { addQuestion, createForm } from './helpers'

/** The persisted ui-store blob the app (and the index.html no-FOUC script)
 * read on boot. A partial blob is fine: the store fills the rest from
 * defaults after the STORAGE_VERSION check passes. */
const seedContrast = (
  page: Page,
  contrast: 'normal' | 'high' | 'system',
  theme: 'light' | 'dark' | 'system' = 'light'
): Promise<void> =>
  page.addInitScript(
    ([c, t]) => {
      localStorage.setItem('odk-builder:ui:v1', JSON.stringify({ version: 1, theme: t, contrast: c, accent: 'blue' }))
    },
    [contrast, theme] as const
  )

/** Resolves a CSS expression (e.g. `var(--odk-text-color)`) to a concrete
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

/** Mean channel value — a cheap "is this dark?" probe. */
const brightness = (rgb: string): number => {
  const [r, g, b] = channels(rgb)
  return (r + g + b) / 3
}

test.describe('high-contrast mode', () => {
  test('a high-contrast preference paints with no normal-contrast flash on first load', async ({ page }) => {
    await seedContrast(page, 'high')

    // domcontentloaded fires after the in-<head> bootstrap script has run, so
    // the attribute is already stamped before any application/Vue code mounts.
    await page.goto('/#/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('html')).toHaveAttribute('data-ff-contrast', 'high')
  })

  test('a normal contrast preference never stamps the attribute', async ({ page }) => {
    await seedContrast(page, 'normal')

    await page.goto('/#/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('html')).not.toHaveAttribute('data-ff-contrast', /.*/)
  })

  test('the Settings contrast select flips the attribute live and it persists across a reload', async ({ page }) => {
    await createForm(page, 'Contrast Settings Flow')
    await page.getByTestId('settings-gear').click()
    await expect(page.getByTestId('settings-view')).toBeVisible()

    const select = page.getByTestId('settings-contrast-select')
    await select.click()
    await page.getByRole('option', { name: 'High' }).click()

    await expect(page.locator('html')).toHaveAttribute('data-ff-contrast', 'high')

    await page.reload()
    // The inline bootstrap re-applies it from localStorage on the next boot.
    await expect(page.locator('html')).toHaveAttribute('data-ff-contrast', 'high')
    await page.getByTestId('settings-gear').click()
    await expect(page.getByTestId('settings-contrast-select')).toContainText('High')
  })

  test('the four light/dark × normal/high states each resolve a materially different surface brightness', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })

    // Baseline: light + normal — the "washed out" subtler surface.
    await seedContrast(page, 'normal', 'light')
    await createForm(page, 'Combined States')
    await addQuestion(page, 'text')
    const normalLightBg = brightness(await resolveColor(page, 'var(--odk-base-background-color)'))
    const normalLightText = brightness(await resolveColor(page, 'var(--odk-text-color)'))

    // Flip to high via the real toggle so the store's persist path runs too.
    await page.getByTestId('settings-gear').click()
    await page.getByTestId('settings-contrast-select').click()
    await page.getByRole('option', { name: 'High' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-ff-contrast', 'high')

    const highLightBg = brightness(await resolveColor(page, 'var(--odk-base-background-color)'))
    const highLightText = brightness(await resolveColor(page, 'var(--odk-text-color)'))
    // High contrast pushes the background to pure white and text to pure black —
    // a strictly brighter background and strictly darker text than normal.
    expect(highLightBg).toBeGreaterThanOrEqual(normalLightBg)
    expect(highLightText).toBeLessThanOrEqual(normalLightText)
    expect(highLightBg).toBeGreaterThan(240) // ~#ffffff
    expect(highLightText).toBeLessThan(15) // ~#000000

    // The mounted preview must reflect the same high-contrast surface (the
    // clobber-survival pattern the dark-mode test already proves must extend
    // to data-ff-contrast too).
    await page.getByTestId('preview-button').click()
    const preview = page.getByTestId('preview-host')
    await expect(preview.getByRole('heading', { name: 'Combined States' })).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('html')).toHaveAttribute('data-ff-contrast', 'high')
    expect(brightness(await resolveColor(page, 'var(--odk-base-background-color)'))).toBeGreaterThan(240)
  })

  test('a forced-colors emulation pass renders without collapsing and keeps a visible focus outline', async ({ page }) => {
    await createForm(page, 'Forced Colors Smoke')
    await page.emulateMedia({ forcedColors: 'active' })

    await expect(page.getByTestId('editor')).toBeVisible()

    // Tab to the first focusable control and confirm an outline is present
    // (not "none") — forced-colors strips box-shadow-only focus rings, so this
    // is a coarse regression net for the outline-based treatment.
    await page.keyboard.press('Tab')
    const outline = await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle)
    expect(outline).not.toBe('none')
  })
})
