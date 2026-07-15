# Central drawer + hub — agent-browser verification pass

**Date:** 2026-07-15 · **Build:** dev server (`pnpm dev`), Chromium via
agent-browser · **Spec:** `docs/specs/2026-07-15-1219-central-ux-enhancement/`

Manual UI/UX walkthrough of the new editor Central drawer (Phase 2 + Phase 3
hub). Scenarios reference `user-guide.md`.

## Setup
Registered one Central server in Settings ("Dev Central", a non-resolving URL),
saved a password → created the vault (the vault-create dialog correctly stays a
modal in Settings, over an inline section — not the bug). Created a blank form
"Central Drawer Test" and opened the editor.

## Results

| Scenario | Result | Evidence |
| --- | --- | --- |
| S2 — Editor entry point | **PASS** — toolbar shows a **Central** toggle (☁ icon + label) where Publish was, gated to `hasServers && !embed`. Toggling highlights it (primary) with a "Hide Central panel" tooltip, exactly like Preview. | `01-hub-unlocked.png` |
| Drawer is non-modal | **PASS** — right-side slide-over with **no scrim**; the canvas ("Your form starts here") stays fully visible and editable behind it. | `01-hub-unlocked.png` |
| Hub content | **PASS** — single global **Vault unlocked · Lock** bar, **Current draft** version, draft-note ("uploads a draft… publish it live in ODK Central"), **PUBLISHED DESTINATIONS** heading + empty state, **Publish to a new destination**. | `01-hub-unlocked.png` |
| S5 — New destination inline | **PASS** — "Publish to a new destination" expands **inline below the list** (list stays visible): server + project pickers, **Create a new form (central_drawer_test)** / **Update an existing form** radios, Cancel / **Publish here**. Not a modal, not a panel swap. | `02-new-destination-inline.png` |
| S3/S1 — One-time session unlock, no stacking | **PASS** — **Lock** flips the drawer to an **inline** "Unlock your Central vault" gate (passphrase + Unlock + "Forgot your passphrase?"), rendered inside the drawer, no modal, no scrim. Entering the passphrase returns straight to the hub. Full-page snapshot reports **0 dialog elements** throughout. | `03-unlock-gate-inline.png` |
| Picker connection error contained | **PASS** — selecting the (non-resolving) server drives the project picker to an inline **"Not connected"** state within the drawer; **0 dialogs** — the old picker-fetch-throws-a-modal path no longer stacks. | (snapshot) |
| S8 — Import from Central (library drawer) | **PASS** — the Form Library toolbar shows a **Central** toggle (same gate) that opens a right-side slide-over: intro, Server/Project/Form pickers (published-only note), Import. Non-modal, **0 dialogs**. The vault stays unlocked across the editor→library hash navigation (one gate per session). | `04-library-import-drawer.png` |
| Import dialog is now file-only | **PASS** — opening **Import form** shows only "Choose a file"; the old File/ODK-Central source toggle is gone. | (snapshot) |

## Not covered here (covered by component tests against a mocked Central)
Actual publish success, 409-conflict recovery (update-instead / bump), Central
warnings, per-destination freshness chip (Up to date / Changed), one-click
re-publish, and Check-server reconcile — these need a mocked Central client and
are exercised in `tests/component/` rather than the live walkthrough.

## Post-review re-verification (2026-07-15)

After the five-lens `/code-review`, the drawer internals were refactored (shared
`CentralDrawerShell`, `useVaultForm`, `ImportReport`, `CentralDrawerToggle`;
`flowStatusProps`; a form-store `revision` signal for freshness; global
in-flight publish guard; 409-recovery now refreshes the list). An agent-browser
re-run confirmed the editor drawer's **unlock gate and unlocked hub render
pixel-identically** to the pre-refactor screenshots (`01`/`03`), with **0
dialogs** throughout. Full suite (1077 unit/component), coverage floors, lint,
typecheck, and e2e (93) all green after the fixes.

## Screenshots
- `01-hub-unlocked.png` — drawer open, unlocked hub, form visible behind.
- `02-new-destination-inline.png` — inline new-destination collapsible.
- `03-unlock-gate-inline.png` — inline session unlock gate (no modal).
- `04-library-import-drawer.png` — library-level Central import drawer.
