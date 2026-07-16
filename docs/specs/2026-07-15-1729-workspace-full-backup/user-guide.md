# Whole-workspace backup & restore — user guide

Form Forge keeps everything in your browser. **Settings → Export workspace**
downloads a single `.formforge.zip` that is your complete backup, and **Import
workspace** restores it — on the same browser after a data wipe, or on a new
device.

## What a backup contains

- **Every form** and its **attachments**.
- Your **ODK Central server settings** — each server's name, URL and email.
- Your **publish history** — which server/project each form was last published to
  (used for one-click re-publish and freshness).
- Your **app preferences** — colour scheme, accent colour, interface language,
  panel layout, and dismissed hints.

By default the backup does **not** contain your saved Central passwords.

## Including saved passwords (optional)

On the Settings page, tick **"Include saved Central passwords"** before exporting
to also carry your credential vault and each server's saved (encrypted) password.
The box is only available while the **credential vault is unlocked** — unlock it
from *Central servers* on the same page first.

> ⚠️ A backup that includes passwords contains them encrypted with your vault
> passphrase. Anyone who has **both the file and your passphrase** can use your
> Central accounts. Store such a backup somewhere safe and don't share it.

## Restoring

Import the archive from **Settings → Import workspace**. The dialog previews how
many forms, Central servers and publish targets it will restore (and whether it
includes saved passwords). Importing **never overwrites** existing forms — forms
come in as new copies.

- **Servers** already registered (same URL + email) are reused, not duplicated.
- **Saved passwords** restore only into a workspace that has **no vault yet** — a
  fresh install or wiped browser. You then unlock with the **same passphrase** you
  used when exporting and can re-publish with no re-typing.
- If the workspace **already has its own vault** (a different passphrase), the
  imported passwords are **not** restored — the dialog warns you, and you re-enter
  each password once from *Central servers*.
- Your **app preferences** (theme, language, layout) are applied on import — the
  dialog notes this in the preview and confirms with a toast. Since importing is a
  restore, this replaces the current device's preferences; they are easily changed
  back in Settings.

## Sharing a single form is different

Exporting one form (the form card's **Export archive**) produces a
credential-free archive with **no** Central data — safe to hand to a colleague.
Only the whole-workspace *Export workspace* carries your Central configuration.
