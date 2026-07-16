# Form Forge for ODK

A visual builder for [ODK](https://getodk.org) forms that runs **entirely in
your browser** — no server, no account, no data leaving your device. Forms
are stored locally (IndexedDB), edited visually, previewed live in the
official [`@getodk/web-forms`](https://www.npmjs.com/package/@getodk/web-forms)
engine, and exported as XForm XML, XLSForm (.xlsx), or either bundled as a
ZIP ready for ODK Central. When you opt in, it can also publish drafts to and
import published forms from your own ODK Central servers. Installable as an
offline app on field laptops and tablets.

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
- **Direct to ODK Central, opt-in** — publish a form's draft (definition +
  attachments) to a Central project and import published forms back, across
  multiple servers, without leaving the builder. It stays invisible until you
  add a server; credentials are encrypted at rest in a passphrase-derived
  vault that never leaves your device, and every connection is manual — no
  background sync, no telemetry.

## Features

### Available

- ✅ **Visual editor** — ~40 question types, drag-and-drop question tree
  with keyboard commands, property panel, undo/redo, autosave, crash
  snapshots, multi-form library
- ✅ **Live engine preview** — real `@getodk/web-forms` rendering, device
  presets, submit testing with submission XML inspection
- ✅ **Import** — XForm XML (lossless) and XLSForm .xlsx with row-level
  import reports
- ✅ **Export** — XForm XML, XLSForm .xlsx, or either as a ZIP bundled with
  media/CSV attachments for ODK Central
- ✅ **ODK Central integration** — opt-in publish and import through a
  non-modal **Central panel** (a slide-over beside the form, never a stack of
  pop-ups), off until you register a server:
  - **Central hub, per form** — one panel lists **every** destination the form
    has been published to (server · project · form id, last version + time),
    each with a **freshness** chip (Up to date / Changed, a purely local content
    compare) and a one-click **Re-publish** / **Publish update** whose progress
    and result render inline on the row. **Publish to a new destination** expands
    inline without leaving the panel.
  - **Publish draft** — push the open form's draft (definition + attachments)
    to a Central project, surfacing Central's validation warnings verbatim; on a
    form-id/version collision, offer to update the existing form or bump the
    version and retry. Promoting the draft to a live version stays in Central's
    own UI, by design.
  - **Check server** — a per-destination metadata read (Central's version, no
    XML download) reconciles what you last sent against what Central now holds.
  - **Import from Central** — a matching Central panel on the Form Library:
    pick server → project → form, pull the published XForm and its attachments,
    and land it with the same row-level report as file import (replace-or-copy
    on a name collision), seeding the origin as the form's first destination.
  - **Multi-server, tracked destinations** — register several servers; publish
    the same form to dev/staging/prod and re-deploy to any of them in one click.
  - **One-per-session vault** — passwords stored encrypted at rest
    (non-extractable AES-GCM, key derived from one passphrase you enter once per
    session, unlocked inline in the panel — no modal); the key and session
    tokens live in memory only. Server config + publish history ride along in a
    **whole-workspace backup**; saved passwords do so only if you opt in on
    export (a warning is shown). A **single-form share** never carries any
    Central data.
  - See the [CORS requirement](#connecting-to-odk-central-cors) below —
    reaching a Central server from the browser needs a one-time server-side
    (or local-proxy) setup.
- ✅ **Choices & cascades** — shared choice lists, cascading-select editor,
  choice filters
- ✅ **Form translations** — multi-language labels, hints, guidance hints,
  constraint/required messages, choice labels and media filenames; the
  grid shows every relevant site even before it has a value (rarely-used
  fields behind a toggle), and the properties panel edits one explicit
  language at a time — fallback text appears as placeholder, never as
  editable text. No "Default" pseudo-language: a monolingual form's text
  converts into the first language you add (which becomes the form's
  default language), matching what ODK clients actually show; mixed
  imports auto-merge, with leftovers kept visible in an Unassigned
  column until resolved
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
- ✅ **Attachment manager** — the Form attachments dialog detects every file
  the form design references and lists what's **missing** with a one-click
  upload under the expected name; rename a file and every reference
  (choices files, label media, implicit CSV lookups) follows in one undo
  step; per-row replace keeps the filename stable; same-name uploads stop
  at an explicit Replace / Keep both / Skip choice (with apply-to-all for
  batches) instead of silently overwriting
- ✅ **Entities** — dataset declaration, create/update/upsert flows
  (pyxform-parity), per-question `save_to` with reserved-name validation,
  follow-up form wizard
- ✅ **Form templates** — bilingual starter gallery (household survey,
  registration, site monitoring, feedback) + save any form as a local
  template
- ✅ **Workspace backup** — export/import the whole library as a lossless
  `.formforge.zip` archive: forms + attachments, your ODK Central server config +
  publish history, and your app preferences (theme, accent, interface language,
  layout); saved passwords are opt-in on export (warning shown). Exporting a
  **single form** stays credential-free — safe to share
- ✅ **In-app help** — single help drawer with a searchable question-type
  reference and per-type detail (appearances, parameters, platform
  support), field-level "?" popovers — each type-specific parameter's "?"
  explains that parameter (description, allowed tokens, default, required,
  and the exact XLSForm `parameters` key) — plus eight step-by-step
  workflow guides (translations, logic, datasets, entities, backup,
  templates, autosave, keyboard) with contextual "?" entry points and
  dismissable first-use callouts for the two silent-behavior traps; fully
  offline, linked to the official ODK docs
- ✅ **Iframe embed API** — origin-pinned postMessage protocol for host
  applications (load/save with attachments, export toggles, memory or
  local persistence); reference host at `/embed-demo.html`
- ✅ **Offline PWA** — installable, full app shell precached, hybrid
  self-update (automatic at load/idle, prompted mid-edit)
- ✅ **Internationalized UI** — English, **French** and **Spanish**,
  terminology-aligned with ODK Collect/Central's own translations;
  auto-detected from the browser language on first run, switchable in
  Settings, host-controllable when embedded; translation-ready foundations
  for more (typed message catalog, RTL-prepared layout)
- ✅ **Light/dark/system theme + accent presets** — a color-scheme
  preference (light, dark, or follow-OS) plus six accent colors (ODK blue,
  purple, green, teal, amber, rose) that restyle the builder chrome **and**
  the live preview together; a 3-state header toggle and a Settings
  "Appearance" section, persisted locally, no light-flash on reload,
  host-controllable when embedded
- ✅ **High-contrast mode (accessibility)** — an orthogonal contrast
  preference (normal, high, or follow-OS via `prefers-contrast`) crossing
  with the color scheme: WCAG-AAA surfaces with hard borders replacing
  tints and shadows, accent colors auto-clamped to 7:1 steps (enforced by
  a unit-tested ratio gate), applied to chrome and preview alike, plus
  forced-colors (Windows Contrast Themes) fixes
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
  state + export readiness summary, richer library cards, fully wrapping
  question labels with jump-free hover actions in the card footer,
  always-labeled Preview/Export; the editor header is grouped into
  labeled clusters with the four form tools (Form settings, Translations,
  Choice lists, Attachments) in a visible **Form** menu beside the title —
  no anonymous overflow menus

### Planned

- ⬜ **More UI languages** — Arabic (RTL), Russian… the i18n foundation and
  the French/Spanish precedent are in place; each language is a catalog
  file away

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

### Connecting to ODK Central (CORS)

ODK Central's API does **not** send permissive CORS headers by default, so a
browser blocks the builder's cross-origin requests until CORS is enabled. This
can only be relaxed **server-side** — there is no pure-client bypass (a public
CORS proxy would route your credentials through third-party infrastructure, so
it's deliberately unsupported). You have two shapes:

- **You control the server** — add the CORS headers at Central's fronting nginx
  (or any reverse proxy / load balancer), or serve the builder same-origin
  behind Central. Copy-paste recipes are in the
  [integration user guide](docs/specs/2026-07-13-1331-central-publishing/user-guide.md#self-hoster-setup-making-central-reachable-from-the-builder-cors).
- **You don't** — run a small local proxy on your own machine. The repo ships
  a script (bash for macOS/Linux, PowerShell for Windows) that downloads a
  stock [Caddy](https://caddyserver.com) binary into `.local/` (gitignored) and
  generates/updates a `Caddyfile` forwarding to your Central server with the
  headers added. Point it at your server and register the proxied URL in the
  builder:

  ```bash
  # macOS / Linux — scripts/central-cors-proxy.sh
  scripts/central-cors-proxy.sh -u https://central.example.org -n my-central
  .local/caddy run --config .local/Caddyfile
  # then register  http://localhost:8123/my-central  as the server URL
  ```

  ```powershell
  # Windows — scripts\central-cors-proxy.ps1
  .\scripts\central-cors-proxy.ps1 -Upstream https://central.example.org -Prefix my-central
  .\.local\caddy.exe run --config .\.local\Caddyfile
  # then register  http://localhost:8123/my-central  as the server URL
  ```

  Re-run it once per server (`-n`/`-Prefix` + `-u`/`-Upstream`) to build up a
  multi-server proxy; both scripts read the same `CENTRAL_PROXY_*` env-var
  defaults and produce an identical Caddyfile. Minimum supported Central:
  **2024.3**.

### Architecture

- `src/core/` — pure TypeScript engines (no Vue/Pinia/Dexie): form model,
  `${field}` ↔ XPath expression rewriting, structured condition grammar,
  XForm serializer/parser, XLSForm reader/writer, dataset parsing,
  workspace archives, validators. Everything here is unit-tested in Node.
- `src/stores/` — Pinia stores (form document + undo/redo + autosave,
  workspace library, preview orchestration, embed config, Central connection
  state; session tokens and the vault key are held in module closures, never
  in reactive/devtools-visible state).
- `src/persistence/` — storage behind a backend seam: Dexie/IndexedDB by
  default (forms, binary attachments, snapshots, templates, plus device-local
  Central servers, encrypted vault meta and publish targets), in-memory for
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
