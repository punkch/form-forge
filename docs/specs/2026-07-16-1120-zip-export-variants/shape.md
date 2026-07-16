<!--
  Shape spec (promoted from docs/specs/backlog/zip-export-variants.md,
  2026-07-16). Open questions resolved with the user 2026-07-16.
-->

# ZIP export variants (XML + attachments / XLSX + attachments) — shape

**Status:** ready for implementation · **Effort:** S (well under a day) ·
**Depends on:** nothing new — reuses `writeXlsForm` (delivered with the
XLSForm reader/writer) and `exportZip` (delivered with workspace
export/import).

## Problem

The editor's Export split-button offers three actions: **XForm XML**
(primary), **XLSForm (.xlsx)**, and a single **"ZIP with attachments"** that
always bundles the serialized XForm (`form.xml`) plus `media/<filename>` for
each stored attachment. Users who work in the XLSForm representation — to
hand the spreadsheet to pyxform-based tooling, keep it as the editable
source of truth, or share it with colleagues alongside its media — have no
way to get the `.xlsx` and its attachments in one download; they must export
the XLSX and the attachment-carrying ZIP separately and re-assemble.

## Scope

Split the single ZIP export into two variants:

1. **ZIP: XForm XML + attachments** — exactly today's bundle (`form.xml` +
   `media/`), unchanged content.
2. **ZIP: XLSForm + attachments** — the `writeXlsForm` workbook
   (`form.xlsx`) plus the same `media/` folder, built from the same full
   `doc.attachments` set as the XML variant.

## Decisions

All three "proposed decisions" from the backlog doc are **adopted**, plus
the three former "open questions" are now **resolved**:

1. **Embed gating stays a single `zip` flag**, controlling both variants.
   `EmbedExportsConfig.zip` in `src/embed/protocol.ts` is unchanged — no
   protocol edit, no additive key. A host that hides `zip` today hides both
   ZIP menu entries after this change; that is the intended, fully
   back-compat behaviour.
2. **Menu labels distinguish the payload.** Final copy: **"ZIP · XForm XML +
   attachments"** and **"ZIP · XLSForm + attachments"**. The old label `'ZIP
   with attachments'` (asserted by e2e) is retired.
3. **In-archive layout stays symmetrical** — `form.xml` vs `form.xlsx` at
   the ZIP root, `media/` beside it. No manifest, no format versioning (this
   is not the `.formforge.zip` workspace archive format).
4. **Download filenames suffix both variants**, for symmetry:
   `<formId>-<version>-xform.zip` and `<formId>-<version>-xlsform.zip`. This
   is a deliberate filename change for existing users of the plain
   `<formId>-<version>.zip` — noted in the user guide as a breaking change to
   the download name (not the archive format).
5. **The XLSX variant bundles the same full `doc.attachments` set** as the
   XML variant — not a subset filtered to columns the XLSForm sheets
   reference. Simplest, and matches the user's intent of "everything the
   form needs" travelling with either representation.
6. **Menu ordering groups both ZIP entries last:** XForm XML (primary) ·
   XLSForm (.xlsx) · ZIP · XForm XML + attachments · ZIP · XLSForm +
   attachments.

## Context

Promoted 2026-07-16 from `docs/specs/backlog/zip-export-variants.md`; open
questions resolved with the user 2026-07-16; the backlog doc's "current
implementation" notes were verified against code the same day and are
corrected in `references.md` (line numbers, exact signatures, and the
`blobs` map's actual key — attachment `id`, not filename).

## Skills & conventions applied

- **Delivery process** (CLAUDE.md) — shape (backlog) → promoted timestamped
  spec folder (this one) → implementation via a dynamic Workflow →
  verification → `/code-review` → conventional commit → docs sweep.
- **unops-toolkit:code-review** — run at delivery (five lenses, no plan
  mode); fix findings immediately, before commit.
- **agent-browser** manual pass over the built app once the menu/filenames
  change, logged to `docs/verification/`; **interface-craft** is not needed
  here — the SplitButton menu markup/layout is unchanged, only label text
  and item count, so there is no new visual surface to critique.
- **Conventional commits**, no `Co-Authored-By` trailer (global user
  instruction).

## Out of scope

- Importing either ZIP variant back — import stays XML / XLSX /
  `.formforge.zip` only.
- Any change to the `.formforge.zip` **workspace** archive format (a
  different, versioned format entirely — manifest + `form.json` +
  attachments, see `src/core/workspace/archive.ts`).
- Any Central publishing interaction — publishing already pushes
  attachments via the Central client, independent of this export menu.
- Filtering the XLSX variant's attachments to only XLSForm-referenced files
  (resolved: bundle the same full set as the XML variant).
- A per-variant embed config key (resolved: single `zip` flag).
