# Form Forge for ODK

A visual builder for [ODK](https://getodk.org) forms that runs **entirely in
your browser** — no server, no account, no data leaving your device. Forms
are stored locally (IndexedDB), edited visually, previewed live in the
official [`@getodk/web-forms`](https://www.npmjs.com/package/@getodk/web-forms)
engine, and exported as XForm XML, XLSForm (.xlsx) or a ZIP ready for ODK
Central. Installable as an offline app on field laptops and tablets.

## Highlights

- **Real preview, not a mock** — the same engine ODK Central serves renders
  your form as you build it, including relevance logic, constraints,
  cascading selects, external datasets and translations. Test-fill and
  inspect the submission XML without anything leaving the browser.
- **pyxform-parity XForm generation** — the serializer's output is golden-
  tested against [pyxform](https://github.com/XLSForm/pyxform) 4.5.0
  (`tests/golden/`), entities included, so generated forms behave exactly
  like XLSForm-converted ones.
- **Native XLSForm engine** — imports and exports .xlsx workbooks fully
  client-side; the first in-browser XLSForm converter (everything else in
  the ecosystem calls pyxform on a server).
- **Lossless round-trips** — unknown columns, custom bind/body attributes
  and unrecognized XForm fragments are preserved through import → edit →
  export.
- **Form logic without syntax** — a visual condition builder for relevance
  and constraints, with the raw expression editor always one click away.
- **Works fully offline** — installable PWA that precaches the entire app
  (preview engine included) and updates itself from the hosting site.
- **Embeddable** — host applications can drive the builder in an iframe
  over a postMessage API: load a form, let the user edit, get the full
  configuration (attachments included) back.

## Features

### Available

- ✅ **Visual editor** — ~40 question types, drag-and-drop question tree
  with keyboard commands, property panel, undo/redo, autosave, crash
  snapshots, multi-form library
- ✅ **Live engine preview** — real `@getodk/web-forms` rendering, device
  presets, submit testing with submission XML inspection
- ✅ **Import** — XForm XML (lossless) and XLSForm .xlsx with row-level
  import reports
- ✅ **Export** — XForm XML, XLSForm .xlsx, ZIP with media/CSV attachments
  for ODK Central
- ✅ **Choices & cascades** — shared choice lists, cascading-select editor,
  choice filters
- ✅ **Form translations** — multi-language labels/hints/choices with a
  translation grid and per-language canvas display
- ✅ **Visual logic builder** — field/operator/value rows with ALL/ANY
  groups for relevance and constraints, constraint presets (ranges, phone,
  email…), calculation templates; unrepresentable expressions stay safely
  in the raw editor
- ✅ **Validation** — live problems panel with click-to-navigate; expression,
  reference, structure, translation, dataset and entity validators
- ✅ **External datasets** — upload CSV/GeoJSON straight from the question's
  property panel (feeds itemsets and `pulldata()` in the preview),
  column-aware value/label dropdowns, unknown-column warnings, dataset
  preview table
- ✅ **Entities** — dataset declaration, create/update/upsert flows
  (pyxform-parity), per-question `save_to` with reserved-name validation,
  follow-up form wizard
- ✅ **Form templates** — bilingual starter gallery (household survey,
  registration, site monitoring, feedback) + save any form as a local
  template
- ✅ **Workspace backup** — export/import the whole library (or one form)
  as a lossless `.formforge.zip` archive, attachments included
- ✅ **In-app help** — single help drawer with a searchable question-type
  reference and per-type detail (appearances, parameters, platform
  support), field-level "?" popovers; fully offline, linked to the
  official ODK docs
- ✅ **Iframe embed API** — origin-pinned postMessage protocol for host
  applications (load/save with attachments, export toggles, memory or
  local persistence); reference host at `/embed-demo.html`
- ✅ **Offline PWA** — installable, full app shell precached, hybrid
  self-update (automatic at load/idle, prompted mid-edit)
- ✅ **Internationalized UI** — English today, translation-ready (typed
  message catalog, RTL-prepared layout)
- ✅ **Settings page** — gear on the library header routing to workspace
  export/import, UI-language selection, and an About panel (app version,
  storage-persistence status)
- ✅ **CI/CD** — lint/typecheck/test/e2e pipeline, release-please
  versioning, GitHub Pages deploys gated on e2e, weekly self-hosted
  Renovate dependency PRs tuned to the repo's version pins (needs a
  `RENOVATE_TOKEN` secret — see the renovate spec user-guide)
- ✅ **UX polish pass (design critique)** — trustworthy visual logic
  builder (notes excluded, sensible defaults, empty-comparison warnings),
  problems panel with per-question location chips and grouping, "Ready"
  state + export readiness summary, richer library cards, two-line
  question labels, always-labeled Preview/Export

### Planned

- ⬜ **ODK Central publishing** — opt-in "publish draft to my Central
  project" with locally-stored credentials; gated on a CORS spike
  ([shaping](docs/specs/backlog/central-publishing.md))
- ⬜ **More UI languages** — French, Spanish, Arabic (RTL), Russian… the
  i18n foundation is in place; each language is a catalog file away

## Development

```bash
pnpm install
pnpm dev          # start the dev server
pnpm test         # unit + component tests (vitest)
pnpm test:e2e     # end-to-end tests (playwright; run `pnpm exec playwright install` once)
pnpm lint         # eslint (neostandard)
pnpm typecheck    # vue-tsc
pnpm build        # production build (static files in dist/)
pnpm verify:webforms  # check ODK design-token/preset parity with @getodk/web-forms
```

Deploy `dist/` to any static host — hash routing needs no rewrite rules.
For project pages under a sub-path, build with `BASE_PATH=/repo-name/`.

### Releasing (GitHub Pages)

CI, release automation and Pages deploys are ready in `.github/workflows/`.

### Embedding

Host pages can embed the builder in an iframe (`?embed=1`) and drive it
over a postMessage API (load/save with attachments, export toggles):
see [`docs/specs/2026-07-09-2235-embed-postmessage-api/user-guide.md`](docs/specs/2026-07-09-2235-embed-postmessage-api/user-guide.md)
and the live reference host at `/embed-demo.html`.

### Architecture

- `src/core/` — pure TypeScript engines (no Vue/Pinia/Dexie): form model,
  `${field}` ↔ XPath expression rewriting, structured condition grammar,
  XForm serializer/parser, XLSForm reader/writer, dataset parsing,
  workspace archives, validators. Everything here is unit-tested in Node.
- `src/stores/` — Pinia stores (form document + undo/redo + autosave,
  workspace library, preview orchestration, embed config).
- `src/persistence/` — storage behind a backend seam: Dexie/IndexedDB by
  default (forms, binary attachments, snapshots, templates), in-memory for
  embed mode.
- `src/components/`, `src/views/` — the builder UI, styled with the design
  tokens `@getodk/web-forms` injects so builder and preview feel like one
  product (guarded by `tests/unit/theme-parity.spec.ts`).
- `src/embed/`, `src/pwa/`, `src/help/`, `src/i18n/`, `src/templates/` —
  the embed bridge/protocol, service-worker update policy, help content,
  message catalogs, bundled starter templates.
- `tests/golden/` — XLSForm fixtures + pinned pyxform output; regenerate
  deliberately with `uv run --with openpyxl --with pyxform scripts/make-goldens.py`.

Product docs live in [`docs/product/`](docs/product/mission.md); each work
package has a spec folder under [`docs/specs/`](docs/specs/) and a browser
verification log under [`docs/verification/`](docs/verification/).
[`CLAUDE.md`](CLAUDE.md) is the repository index for AI-assisted work.

## License

See [LICENSE](LICENSE).
