<!--
  Shape spec (promoted from docs/specs/backlog/workspace-full-backup.md,
  2026-07-15). Delivered format-v2 whole-workspace backup.
-->

# Full workspace backup (Central config + opt-in credentials) — shape

**Status:** delivered 2026-07-15 · **Effort:** M · **Depends on:** delivered
central-publishing + central-ux-enhancement (the Central tables this backs up).

## Problem

Settings → *Export/Import workspace* (`.formforge.zip`) is presented and used as
a whole-workspace **backup**, but it captured only **forms + attachments**.
Everything in the Central tables — registered servers, the credential vault,
each server's saved encrypted password, and per-form publish targets — was
silently omitted, so a restore on a new device lost all Central configuration.

The archive was designed **credential-free by construction**, and the **same
format + code path** served both *sharing a single form* and *backing up the
workspace*. Making the backup complete without care would have leaked Central
config/credentials into every shared single-form archive.

## Locked decisions

1. **A full workspace backup carries the non-secret Central data by default** —
   forms + attachments **plus** server *config* (name/URL/email) and per-form
   **publish targets**. No secrets in the default backup.
2. **Saved credentials are opt-in.** The credential material — each server's
   `encryptedPassword` **and** the `centralVault` salt/key-check — is gated
   behind an **unchecked** export checkbox ("Include saved Central passwords")
   with a security warning, and is enabled only while the vault is **unlocked**
   (proof of passphrase ownership; a locked/absent vault has nothing to include).
   Opting in makes restore **turnkey** (same passphrase unlocks, no re-entry).
3. **Single-form / shareable exports stay credential-free** — unchanged, **format
   v1**, never carry *any* Central data. Only Settings → *Export workspace*
   produces the fuller v2 backup. Isolation is preserved for the share path and
   stays test-enforced (`tests/unit/central-export-isolation.spec.ts`).

## As built

**Format v2** (`src/core/workspace/archive.ts`)
- `manifest.formatVersion` is **1** for a share (no `central/`), **2** for a
  backup; a backup manifest also carries `includesCredentials: boolean`.
- `central/servers.json` (always; `encryptedPassword` base64, omitted unless
  opted in), `central/targets.json` (always), `central/vault.json` (only when
  opted in; `salt` + `keyCheck` base64). Byte fields use a pure browser-safe
  `bytesToBase64`/`base64ToBytes` (btoa/atob, **no** Buffer) — plain
  `JSON.stringify` of a `Uint8Array` is lossy and is never used.
- The reader reads **v1 and v2**; a v1-capped older build rejects v2 cleanly
  (`workspace.format-version-unsupported`). Central shapes are defined in pure
  core so `archive.ts` stays Dexie-free.

**Export** (`gatherWorkspaceBackup` in `src/persistence/workspace-io.ts`)
- Reads the same forms as before **plus** `listCentralServers()` + the union of
  publish targets. When `includeCredentials` is false it **strips**
  `encryptedPassword` from every server and **omits** the vault — the strip
  happens in the gather step, so a secret never reaches the pure builder unless
  opted in. `exportWorkspace({includeCredentials})` is the only caller;
  `exportFormArchive` passes no `central` (byte-unchanged v1 share).

**Restore** (`importWorkspaceBackup`)
- Forms import as new records → `formRecordId` remap.
- Servers de-duped by `(baseUrl, email)`: a match reuses the existing row (never
  overwriting its config/password); otherwise a fresh row is inserted →
  `serverId` remap.
- **3-way credential branch:** archive has no vault → config only; archive has a
  vault **and** the workspace has none → install the vault + keep passwords
  (turnkey); archive has a vault **but** the workspace already has one → keep the
  existing vault, drop the imported passwords, warn
  (`workspace.credentials-not-restored`).
- Targets remap `formRecordId` + `serverId` and `upsertTarget`; any whose form or
  server did not import are dropped. Additive, best-effort, issues collected.

**UI**
- Settings export: an unchecked **"Include saved Central passwords"** checkbox,
  disabled (with an unlock hint) unless the vault is unlocked; the warning shows
  only while ticked.
- Import dialog: after reading a v2 backup, a Central summary line (*N Central
  servers · M publish targets*, plus "includes saved passwords" when the archive
  carries credentials) and the existing-vault warning surface before/after apply.

## Security

The default backup contains **no secrets**. When opted in, the file holds
passphrase-encrypted credential material and is offline-attackable via PBKDF2
(600k iterations) — strength rests on the passphrase; the export warning says so.
The single-form/share path stays credential-free (invariant + test), so handing a
form to a colleague never ships secrets.

## Out of scope

Changing the share format (stays v1); cross-user credential *sharing*; a separate
backup passphrase; selective/partial restore; a destructive "replace workspace"
restore mode (additive-only for v1).

## Tests

`tests/unit/workspace-full-backup.spec.ts` (both backends): opt-out (no
`encryptedPassword`/`vault.json`, sentinel-scanned), opt-in round-trip (vault +
passwords byte-exact, ids remapped, vault unlocks with the original passphrase),
existing-vault (passwords dropped + warning), server dedupe, and v1 (no central).
`central-export-isolation.spec.ts` rescoped to pin the share path. Component
coverage in `settings-view.spec.ts` (opt-in checkbox) and
`workspace-archive-dialog.spec.ts` (Central restore).
