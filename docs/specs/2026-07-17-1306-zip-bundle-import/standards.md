# Skills & Conventions for ZIP bundle import

Standing repository invariants that bind this work (source: `CLAUDE.md`).

---

## `src/core/` purity

- **Why it applies:** the new `src/core/import-zip.ts` and the `mediatypeFor`
  helper in `src/core/model/attachment-role.ts` live in core.
- **Key points:** no Vue/Pinia/Dexie/vue-i18n imports. JSZip is fine — core
  already imports it (`export/zip.ts`, `workspace/archive.ts`). Issues are
  plain objects with stable `code` strings and **verbatim English messages**
  rendered as-is in the UI; never localize in core.

## Verbatim-English Issue messages / e2e substring pins

- **Why it applies:** the feature adds new issue codes and extends the
  `import.unsupported-file` message.
- **Key points:** `tests/e2e/import-export.spec.ts` asserts the substring
  `not an XForm` — the extended message
  (`"<name>" is not an XForm (.xml), XLSForm (.xlsx) or form ZIP file.`)
  must keep it. New codes: `import.invalid-zip`, `import.workspace-archive`,
  `import.zip-no-form`, `import.zip-both-forms`.

## Persistence via the backend seam

- **Why it applies:** landing uses `createFormWithArchiveAttachments` /
  `replaceFormWithArchiveAttachments` (→ `backend.importForm`/`replaceForm`).
- **Key points:** no direct Dexie access from components; behavior must hold
  on both backends (`tests/helpers/backends.ts`). **No schema change** here —
  no Dexie version bump, no `WORKSPACE_FORMAT_VERSION` bump.

## i18n three-catalog parity (en/fr/es)

- **Why it applies:** new `importExport.import.*` keys (collision prompt,
  copy/replace labels, replace confirm, updated `dropHint`).
- **Key points:** every en key change must land identically in
  `src/i18n/locales/{fr,es}/importExport.json` or `pnpm typecheck` fails
  (`MessageSchema = typeof en`, fr/es `satisfies`). Terminology per the
  glossary in `docs/specs/2026-07-16-1125-ui-localization-fr-es/`.

## `data-testid` preservation

- **Why it applies:** the collision block is extracted from
  `LibraryCentralDrawer.vue` into a shared `ImportCollisionPanel.vue`.
- **Key points:** existing testids `library-central-collision`,
  `library-central-collision-copy`, `library-central-collision-replace` must
  survive byte-identical (component tests depend on them), alongside the
  pinned `import-form`, `import-file-input`, `import-report`,
  `import-confirm`. New testids: `import-collision`,
  `import-collision-copy`, `import-collision-replace`.

## Golden byte-stability (pyxform 4.5.0)

- **Why it applies:** the importer calls `parseXForm`/`readXlsForm` but must
  not modify them.
- **Key points:** serializer/parser/XLSForm io untouched; zero engine files
  in the diff; goldens never regenerated for this feature.

## Conventional commits, no co-author trailers

- **Key points:** release-please derives versions from commit messages; work
  directly on `main`. Never add `Co-Authored-By` or any self-attribution
  (user's global instruction overrides defaults).

## Delivery process

- **Key points:** spec folder first → dynamic Workflow with parallel agents
  (cheap models for implementation stages, session model for review) → full
  suite + coverage floors + lint/typecheck + e2e → agent-browser manual pass
  logged to `docs/verification/` → `/code-review` (five lenses, no plan
  mode), fix findings immediately → conventional commit → README/roadmap/
  CLAUDE.md updated in the same change.
