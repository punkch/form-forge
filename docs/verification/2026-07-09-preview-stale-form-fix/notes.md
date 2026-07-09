# Preview stale-form fix verification (agent-browser)

Bug: opening a second form's editor showed the *previously* opened form in
the live preview panel. Verified fixed against the production build:
`pnpm build`, then `pnpm preview --port 4180` (static SPA, fresh browser
profile / empty IndexedDB).

## Scenario

- [x] **Step 1 — PASS.** Created form "Wave0 A", added a Text question from
      the palette, set its label to "Alpha question". Toggled the live
      preview: the real ODK Web Forms engine rendered the "Wave0 A" title
      and the "Alpha question" text input (panel text:
      `Wave0 A / Alpha question / Send / Powered by ODK`).
      Screenshot: `screenshots/step1-wave0a-alpha-preview.png`.
- [x] **Step 2 — PASS.** "Back to forms" returned to the library; the card
      "Wave0 A · wave0_a · 1 question" is listed.
- [x] **Step 3 — PASS.** Created a second form "Wave0 B"; its editor opened
      with an empty canvas ("Your form starts here") and the preview panel
      still docked open from the previous session.
- [x] **Step 4 — PASS (the fix).** The preview panel does NOT show
      "Alpha question" or any Wave0 A content. It shows the designed empty
      state: "The preview appears once the form has questions."
      Screenshot: `screenshots/step4-wave0b-empty-preview.png`.
- [x] **Step 5 — PASS.** Added a Text question to Wave0 B and set its label
      to "Beta question". The preview refreshed to render the "Wave0 B"
      title and the "Beta question" input — no stale Wave0 A content
      (panel text: `Wave0 B / Beta question / Send / Powered by ODK`).
      Screenshot: `screenshots/step5-wave0b-beta-preview.png`.

**Result: PASS (5/5).** The preview never rendered the previously opened
form; each editor session previews only its own form.

**Verified 2026-07-09** with agent-browser (headless Chromium) against the
production build served by `vite preview` on port 4180.
