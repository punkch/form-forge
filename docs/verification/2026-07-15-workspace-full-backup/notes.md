# Verification — whole-workspace backup (format v2)

Spec: `docs/specs/2026-07-15-1729-workspace-full-backup/`. Date: 2026-07-15.

## Automated

- **Unit/component:** `pnpm test` → 122 files, **1100 tests** pass. New/updated:
  - `tests/unit/workspace-full-backup.spec.ts` (both backends): opt-out (no
    `encryptedPassword`/`vault.json`, sentinel-scanned), opt-in round-trip (vault
    + password byte-exact, ids remapped, vault unlocks with the original
    passphrase), existing-vault (passwords dropped + warning), server dedupe, v1
    no-central, **corrupt-base64 skips only the bad blob**, and **turnkey adopts
    the password for a deduped password-less server**.
  - `tests/unit/central-export-isolation.spec.ts` rescoped to pin the **share
    path** (no central material in a single-form export).
  - `tests/component/settings-view.spec.ts` (opt-in checkbox disabled/enabled,
    unlock prompt, v2 export carries `central/vault.json`),
    `workspace-archive-dialog.spec.ts` (Central summary + restore).
- **Typecheck / lint:** `pnpm typecheck` + `pnpm lint` clean.
- **Coverage:** `pnpm test:coverage` floors held (persistence 97.99/84.61/98.02/99.74).
- **E2E:** `tests/e2e/workspace-archive.spec.ts` (chromium) — real
  export → wipe → import round-trip passes against the built app (the whole-
  workspace export is now format v2).

## Live (agent-browser, dev server)

Settings → Workspace:
1. With the vault **locked**, "Include saved Central passwords" renders
   **disabled** with an **"Unlock vault"** button beside it. ✓
2. Clicking **Unlock vault** opens the shared vault dialog (create mode, since no
   vault existed); creating a passphrase enables the checkbox and removes the
   unlock button. ✓
3. Ticking the checkbox reveals the amber security warning
   ("The backup file will contain your saved Central passwords … store it
   somewhere safe and don't share it."). ✓
4. The export/import descriptions now mention the Central server settings +
   publish history. ✓ (purple accent = the new default accent, incidentally
   confirmed.)

Screenshot: `screenshots/settings-credential-optin.png`.

## Code review

`code-reviewer` adversarial pass (five lenses). Security invariants confirmed
(opt-out is credential-free by construction; share path stays v1/credential-free;
base64 lossless; restore never overwrites). Three non-critical findings raised
and **all fixed + regression-tested**:
1. `atob` throw on a corrupt blob discarded the whole `central/` section →
   `coerceWireBlob`/`coerceVault` now catch per-entry.
2. Turnkey restore dropped the imported password for a deduped password-less
   server → now adopted (safe: no existing row can hold a password when a fresh
   vault is installed).
3. A post-forms restore failure gave no feedback → vault write guarded (issue
   collected) + `importNow` `catch` shows an error toast.
