# Form templates & starter gallery — shaping (backlog)

## Problem

New users face an empty canvas. Common instruments (household survey,
registration, monitoring visit, feedback) share well-known shapes; starting
from one teaches the tool and saves an hour.

## Scope

- A **template gallery** in the "New form" flow: bundled starter templates
  with name, description, question count, preview thumbnail.
- **"Save as template"** on any form: stores a local template (per-browser).
- Templates are ordinary `FormDocument`s — no new format.

## Approach

- Bundled templates: `src/templates/*.json` (FormDocument literals) +
  a `src/templates/index.ts` registry `{ id, title, description, tags,
  load: () => import('./household.json') }` so templates are lazy chunks.
  Author them **in the builder itself** and export via the workspace-archive
  form.json (see workspace-export-import spec) — no hand-written JSON.
- Local templates: a `templates` Dexie table mirroring `forms` (doc without
  attachments in v1; attachments make templates heavy and are rarely
  template-worthy — revisit if asked).
- "New form" dialog becomes two-step: blank | from template (gallery grid).
  Instantiation = `structuredClone(doc)` + fresh node ids via the existing
  `cloneSubtree` walk + user-provided title → `newDocument`-style settings
  reset (new formId slug, today's version).
- Thumbnails: render nothing fancy — show the first ~5 question titles as a
  text preview (cheap, honest, and localizable).

## Decisions (proposed)

- 4 bundled starters to begin with: Household survey, Individual
  registration, Site monitoring visit, Feedback/satisfaction (each
  bilingual EN+FR to show off translations).
- Community template sharing is explicitly out of scope (no backend).

## Open questions

- Should "Save as template" strip logic (relevance/constraints) or keep it?
  Proposal: keep everything; templates are full forms.

## Acceptance

New-from-template produces a valid form (0 validation errors) that previews
in the engine; saved local templates survive reload; e2e covers both paths.
