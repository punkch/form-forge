# User Guide — Theming: light/dark/system + accent presets

Form Forge can follow your system's light/dark preference, be pinned to light or
dark, and be recolored with one of six accent presets. Your choice restyles the
**whole surface** — the builder chrome **and** the live ODK Web Forms preview —
and is remembered on your device. Embed hosts can drive the same two dimensions.

## Choosing a scheme and accent (Settings)

1. Open **Settings** (gear on the Forms library) → **Appearance**.
2. **Color scheme** — pick one of:
   - **Light** — always light.
   - **Dark** — always dark.
   - **System** (default) — follows your operating system's light/dark setting
     and switches live when the OS does.
3. **Accent** — click a swatch to recolor buttons, focus rings, selection and
   other primary elements:
   - **Blue** (default) — the ODK primary color.
   - **Purple**, **Green**, **Teal**, **Amber**, **Rose**.

   The same accent applies in both light and dark. (Green is a slightly deepened
   shade and Amber uses dark button text so labels stay readable — both keep
   button text within accessibility contrast guidelines.)

Your choice is saved locally and applied immediately, including in the live
preview. Reloading in dark shows no light flash.

## The header toggle

The **library header** has a quick **theme toggle** that cycles **light → dark
→ system** on each click — so you can flip to dark and get back to "follow my
OS" without opening Settings. It changes the same preference the Settings
**Appearance** section shows. (The editor header no longer hosts the toggle —
it is a device preference, not a document action; see the
2026-07-16-1122-editor-toolbar-declutter spec.)

## High contrast

Since 2026-07-16 the Appearance section also has a **Contrast** select
(Normal / High / Follow system) that crosses with the color scheme — see
`docs/specs/2026-07-16-1124-high-contrast-mode/user-guide.md` for the full
behaviour (AAA surfaces, accent clamping, preview treatment, forced-colors).

## Embedding: host-controlled theme, accent and contrast

Host applications that embed the builder in an iframe can set the scheme,
accent and contrast through the existing embed configuration (`init` or
`set-config`), the same way they set the UI `locale`. Three additive config
keys:

| Key | Values | Notes |
| --- | --- | --- |
| `theme` | `'light'` \| `'dark'` \| `'system'` | `'system'` makes the embedded builder follow the **host viewer's** OS scheme. |
| `accent` | `'blue'` \| `'purple'` \| `'green'` \| `'teal'` \| `'amber'` \| `'rose'` | Recolors chrome + preview primary elements. |
| `contrast` | `'normal'` \| `'high'` \| `'system'` | `'system'` follows the host viewer's `prefers-contrast`. Added 2026-07-16. |

Precedence and defaults:

- A host-supplied `theme` / `accent` **overrides** the device's persisted
  preference while embedded (mirroring how embed `locale` overrides the stored
  locale).
- Omit a key to leave that dimension under the user's/device's own preference —
  e.g. send only `accent` to match your brand color while still respecting the
  viewer's light/dark choice.
- Unknown values are ignored (validated on receipt), so a bad key can never break
  the embed.
- No protocol-version bump was needed — both keys are additive.

The reference host at `/embed-demo.html` demonstrates setting `theme` and
`accent` via `set-config`.

## Notes

- **Installed PWA color:** the app's installed-icon and splash colors (from the
  web app manifest) stay light — a manifest can't react to a runtime preference.
  The browser tab/address-bar color (`theme-color`) does follow your choice.
- **Nothing leaves your device:** the theme preference is stored locally
  alongside your other UI preferences; there is no account and no sync.
