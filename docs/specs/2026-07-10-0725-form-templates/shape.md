# F2 — Form Templates & Starter Gallery — Shaping Notes

Shaped from `docs/specs/backlog/form-templates.md`.

## Problem

New users face an empty canvas. Common instruments (household survey,
registration, monitoring visit, feedback) share well-known shapes; starting
from one teaches the tool and saves an hour.

## Scope

- A **template gallery** inside the "New form" flow: four bundled starter
  templates plus locally saved ones, each with name, description, question
  count and a first-labels text preview.
- **"Save as template"** on any library form: stores a local template
  (per-browser, Dexie).
- Templates are ordinary `FormDocument`s — no new format.

## Decisions

- **Bundled templates are generated artifacts.** The backlog proposed
  authoring them in the builder and exporting; instead they are built
  programmatically by `scripts/make-templates.ts` using the model factory/ops
  APIs, validated (0 validation errors, 0 serializer errors) and written to
  `src/templates/<slug>.json`. The generator is deterministic (fixed ids and
  version stamp), and `tests/unit/templates-generator.spec.ts` asserts the
  checked-in JSON matches its output byte for byte — hand-edits that drift
  from the generator fail CI. Regenerate with
  `REGENERATE_TEMPLATES=1 pnpm vitest run tests/unit/templates-generator.spec.ts`.
- **Four starters, bilingual EN+FR**: household survey (with a member
  repeat), individual registration, site monitoring visit,
  feedback/satisfaction. 10–13 questions each, realistic types
  (text/integer/select_one/date/geopoint/note) plus a little logic
  (constraints with messages, `${ref}`-based relevance). Content languages
  use the model's canonical keys `English (en)` / `French (fr)`.
- **Gallery metadata is split**: registry titles/descriptions go through the
  UI catalog (`library.templates.*` keys) so the builder chrome stays
  translatable; template *content* stays bilingual inside the JSON.
  `questionCount`/`preview` are precomputed in the registry (templates load
  lazily) and kept honest by `tests/unit/templates-registry.spec.ts`.
- **Instantiation = `instantiateTemplate(template, title)`** in the model
  factory: structured deep-clone, fresh id for every node at every depth
  (`visit` walk — `cloneSubtree` is single-node with renaming, wrong tool),
  settings reset like `newDocument` (title, slugified formId, today's
  version), attachments dropped.
- **Local templates strip attachments** (backlog decision confirmed):
  `templates` Dexie table (schema v2), doc stored without attachment refs,
  count + preview precomputed at save time. Logic (relevance/constraints) is
  kept — templates are full forms.
- **Dialog is two-phase, blank path unchanged.** The gallery phase shows the
  blank card + template grid *and* the title field, so the legacy flow
  (open → type title → Create) still works with zero extra clicks and the
  `new-form-title`/`new-form-create` testids keep their meaning for every
  existing e2e helper. Picking a card switches to the confirm phase
  (summary + back) with the title prefilled from the template.
- **Load guard**: bundled JSON goes through `migrateDoc` on load; a corrupt
  artifact throws and surfaces as an inline dialog error instead of leaking
  a malformed doc into the editor.

## Out of scope

- Community template sharing (no backend).
- Template thumbnails beyond the first-5-labels text preview.
- Attachments inside templates (revisit if asked).

## Acceptance

New-from-template produces a valid form (0 validation errors) that previews
in the real engine; saved local templates survive reload; e2e covers both
paths (`tests/e2e/templates.spec.ts`).
