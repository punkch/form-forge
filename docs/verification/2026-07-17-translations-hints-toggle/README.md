# Manual verification — translations grid "Show hints" toggle (2026-07-17)

Agent-browser pass against the production build (`pnpm preview`, :4173),
Chromium. All three scenarios pass.

| # | Scenario | Result | Evidence |
| --- | --- | --- | --- |
| a | Fresh form (Text question, no hint text) → Translations dialog: the grid shows only `text · Label`; the toolbar has **Show hints** (unchecked) before **Show rarely-used fields** | ✅ | `01-hints-hidden-default.png` |
| b | Checking **Show hints** reveals the empty `text · Hint` row in place | ✅ | `02-hints-toggle-on.png` |
| c | Content-driven default: close the dialog, fill the Hint in the properties panel ("Enter your full name"), reopen Translations → **Show hints** starts checked and the hint row shows its text without any toggle | ✅ | (snapshot-verified) |

Automated coverage: `tests/component/translations.spec.ts` (default-hidden +
reveal + stats + content-driven remount default) and
`tests/e2e/translations.spec.ts` (toggle reveal grows the completeness
denominator; hint round-trip re-import shows hint rows untoggled) — 12/12 e2e
on chromium + firefox, 1396 unit/component tests green.
