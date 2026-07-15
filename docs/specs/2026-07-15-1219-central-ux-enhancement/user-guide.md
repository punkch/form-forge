# Central drawer + hub — User guide & manual test scenarios

## What changed for the user

Everything about "talk to my ODK Central server" now lives in **one place per
form**: a **Central** drawer that slides in beside your form (it does not cover
it), instead of a stack of pop-up dialogs.

- **Open it** from the editor toolbar's **Central** button (where **Publish**
  used to be). It toggles like the **Preview** pane — the button highlights while
  the drawer is open.
- **Unlock once.** If you have saved a server password, the first time you open
  Central this session you enter your vault passphrase once. After that every
  saved server is ready for the rest of the session — no more repeated unlock
  pop-ups. **Lock** is always available in the drawer header (it also clears
  in-memory session tokens).
- **See every destination.** The drawer lists **all** the Central destinations
  this form has been published to — dev, staging, prod, another org's server —
  each showing its server · project · form id, the version and time it last
  received, and a **freshness** chip: **Up to date** or **Changed**.
- **Re-publish in one click.** Each destination has a **Re-publish** (or
  **Publish update** when the row is *Changed*) button. Progress and the result
  appear right on that row.
- **Publish somewhere new.** **Publish to a new destination** expands inline
  below the list — pick a server, project, and form id, publish, and it's added
  to the tracked list for next time. The list stays visible while you do it.
- **Check a server** (per destination, on demand) reads Central's current
  version + fingerprint for that form — no full download — so you can confirm
  whether Central still matches what you last sent, or someone changed it there.
- **Import from Central** now has its own Central drawer on the **Form Library**,
  in the same language as the editor drawer, instead of a hidden toggle inside
  the Import dialog. File import stays in the Import dialog.

### What has NOT changed (by design)
- **Publishing uploads a draft.** Your form lands as the **draft** on Central and
  stays there until someone reviews and publishes it live in Central's own UI.
  "Published to Staging" here means "draft uploaded to Staging."
- **One version.** Your form has a single version (Form Settings). Central owns
  version uniqueness; if a version string is already published on a server,
  Central rejects it and Form Forge bumps the version and retries.
- **Nothing Central appears in embedded mode.**

## Manual test scenarios

Run against the built app (`pnpm build && pnpm preview`, or the e2e harness on
`:4173`) with a mocked or real Central. Log results + screenshots to
`docs/verification/`.

### S1 — No modal ever stacks (the core fix)
1. Register a server with a saved password (Settings) and lock the vault.
2. Open the **Central** drawer, start a publish. When unlock is needed, the
   unlock step appears **inline / once for the session** — never a second dialog
   thrown over the flow.
3. Trigger the forgotten-passphrase path; confirm the reset lives inside the same
   surface, not a third stacked modal.
   **Pass:** peak overlay depth is the drawer only; no modal-on-modal.

### S2 — Editor entry point
1. In a form with ≥1 registered server, confirm the toolbar shows a **Central**
   button (icon + label) where Publish was, gated to hide in embed and when no
   servers exist.
2. Toggle it: the drawer opens/closes and the button reflects the open state
   (highlight + `aria-pressed`), exactly like **Preview**.

### S3 — One-time session unlock gate
1. Fresh session, saved password, vault locked. Open Central → enter passphrase
   once → drawer shows hub content.
2. Close and reopen the drawer, and open Import's Central drawer → **no** second
   unlock prompt. Click **Lock** → reopening prompts again.

### S4 — Multi-destination list + freshness
1. Publish the same form to two destinations (e.g. Dev and Prod, or two
   projects). Both appear as rows with server · project · form id, version, time.
2. Edit a question label (do not change the version). The affected rows flip to
   **Changed**; their action reads **Publish update**. Untouched state elsewhere
   stays **Up to date**.
3. **Publish update** on a *Changed* row → progress + result render inline on
   that row; on success it returns to **Up to date**.

### S5 — Publish to a new destination (inline)
1. Click **Publish to a new destination** → a collapsible expands **below** the
   list; the existing rows stay visible.
2. Pick server → project → (new or existing) form id → publish. On success the
   new destination joins the tracked list and is one-click re-publishable.
3. Two destinations that differ only by form id within one project must appear as
   **two distinct rows** (triple identity), not one.

### S6 — Check a server (on-demand reconcile)
1. On a destination row, click **Check server**. A single metadata read runs (no
   full XML download); the row shows Central's current version/fingerprint vs
   what we last sent (e.g. "matches", "N behind", or "changed on server").
2. Confirm no network happens automatically just from opening the drawer.

### S7 — 409 version conflict (Central-authoritative)
1. Publish a version string a server already has published. Central returns
   `409`; the app bumps the version and retries, succeeding. The row shows the
   new version. (No pre-bump happened before Central objected.)

### S8 — Import from Central (library drawer)
1. On the Form Library, open the **Central** drawer, browse a server/project,
   pick a form, import it. It lands in the library and its source is seeded as
   the first tracked destination (visible when you open that form's editor
   drawer).
2. Confirm the old source-toggle inside the Import dialog is gone; **File**
   import still works in the Import dialog.

### S9 — Server with no saved password
1. Register a server but save no password. Its destination rows / new-destination
   picker show a **needs password (Settings)** affordance — not a lock/connect
   state — and cannot sign in until a password is saved.

### S10 — Embed safety
1. Load the app embedded. Confirm **no** Central button, drawer, or import-Central
   surface is reachable.
