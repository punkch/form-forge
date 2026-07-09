# Deeper entity support — shaping (backlog)

## Problem

Spec 04 ships entity **creation** with pyxform-parity (dataset, label,
create_if, save_to). Real entity workflows also need: forms that *consume*
entity lists, update flows with base versions, and authoring guidance —
the ODK Entities spec is still evolving upstream.

## Scope (tracks the ODK spec)

- **Entity-consuming selects**: first-class UX for
  `select_one_from_file <dataset>.csv` where the file is an entity list —
  today it's just a filename; make the dataset relationship explicit.
- **Update flows**: complete `update_if` / `entity_id` /
  `baseVersion` serialization (create path is golden-tested; update path
  is implemented but not golden-pinned) + a follow-up-form authoring
  pattern in the UI (pick the entity list, auto-add the id/label
  plumbing).
- **Entity property editor**: manage `save_to` mappings in one place
  (which fields feed which entity properties, with reserved-name
  validation — `name`/`label` are rejected, already enforced by pyxform).
- **Dataset preview**: reuse the external-dataset-tooling table for local
  sample entity lists so authors can test cascades offline.

## Approach

- Extend the golden harness first: add `entities_update` and
  `entities_follow_up` fixtures to `scripts/make-goldens.py`, regenerate,
  and pin the update-path serialization before touching code (the Spec 04
  method).
- Model already carries `EntityDeclaration { datasetName, label, createIf,
  updateIf, entityId }` and `saveTo` per node — no schema change expected
  beyond a possible `offlineSample?: AttachmentRef` link for preview data.
- UI: an "Entities" tab inside FormSettingsDialog (declaration + save_to
  overview table); per-question `save_to` stays in the property panel.
- Validation: extend `src/core/validate/entities.ts` (already exists) with
  reserved property names, duplicate save_to targets, and
  follow-up-form consistency (entity_id present ⇒ some consuming select or
  parameter).

## Open questions

- Which `entities-version` values must we emit for update flows
  (2023.1.0 vs 2024.1.0 feature gates)? Resolve against pyxform source
  when scheduling.
- Does @getodk/web-forms preview entity-consuming forms without a Central
  server (local entity list attachment)? Spike early — if not, preview
  degrades gracefully via missingResourceBehavior.

## Acceptance

Update-flow goldens pass; a follow-up form authored in the builder
round-trips through XLSForm export → pyxform with identical output; entity
validation catches reserved names and dangling ids.
