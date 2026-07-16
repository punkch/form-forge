// Narrow pins for the Task 12 forced-colors audit — mechanical enough to check
// as plain text (a `forced-colors: active` query block exists with the
// expected declaration), not a real forced-colors render (happy-dom/jsdom
// don't emulate the feature; the actual visual audit is the manual
// /agent-browser + DevTools emulation pass, see docs/verification/).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('../..', import.meta.url))
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8')

describe('forced-colors audit — accent swatches keep their real colour', () => {
  const css = read('src/views/SettingsView.vue')

  it('opts .accent-swatch out of forced-colors repainting', () => {
    expect(css).toMatch(/@media \(forced-colors: active\)\s*\{\s*\.accent-swatch\s*\{[^}]*forced-color-adjust:\s*none/)
  })
})

describe('forced-colors audit — category type-chips keep their real colour', () => {
  const css = read('src/components/canvas/TreeNodeCard.vue')

  it('opts .type-chip out of forced-colors repainting', () => {
    expect(css).toMatch(/@media \(forced-colors: active\)\s*\{\s*\.type-chip\s*\{[^}]*forced-color-adjust:\s*none/)
  })
})

describe('forced-colors audit — the split-handle drag affordance gets a forced border to land on', () => {
  const css = read('src/components/shell/SplitHandle.vue')

  it('gives the background-only ::after affordance a transparent border under forced-colors', () => {
    expect(css).toMatch(/@media \(forced-colors: active\)\s*\{[\s\S]*\.split-handle::after\s*\{[^}]*border-inline-start:\s*2px solid transparent/)
  })

  it('colours that border with the Highlight system colour on hover/focus/drag', () => {
    expect(css).toMatch(/border-inline-start-color:\s*Highlight/)
  })
})

describe('forced-colors audit — the global focus ring stays outline-based', () => {
  const css = read('src/styles/builder.css')

  it(':focus-visible uses outline, not box-shadow, which forced-colors would strip', () => {
    const rule = /:focus-visible\s*\{([^}]*)\}/.exec(css)
    expect(rule).not.toBeNull()
    const body = (rule as RegExpExecArray)[1]
    expect(body).toMatch(/outline:/)
    expect(body).not.toMatch(/box-shadow:/)
  })
})
