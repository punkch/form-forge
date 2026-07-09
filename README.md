# ODK Form Builder

A visual builder for [ODK](https://getodk.org) forms that runs **entirely in
your browser** — no server, no account, no data leaving your device. Forms are
stored locally (IndexedDB), edited visually, previewed live in the official
[`@getodk/web-forms`](https://www.npmjs.com/package/@getodk/web-forms) engine,
and exported as XForm XML, XLSForm (.xlsx) or a ZIP ready for ODK Central.

## Highlights

- **Real preview, not a mock** — the same engine ODK Central serves renders
  your form as you build it, including relevance logic, constraints,
  cascading selects and translations. Test-fill and inspect the submission
  XML without anything leaving the browser.
- **pyxform-parity XForm generation** — the serializer's output is golden-
  tested against [pyxform](https://github.com/XLSForm/pyxform) 4.5.0
  (`tests/golden/`), so generated forms behave exactly like XLSForm-converted
  ones.
- **Native XLSForm engine** — imports and exports .xlsx workbooks fully
  client-side; the first in-browser XLSForm converter (everything else in the
  ecosystem calls pyxform on a server).
- **Lossless round-trips** — unknown columns, custom bind/body attributes and
  unrecognized XForm fragments are preserved through import → edit → export.
- **Local-first** — autosave, undo/redo, crash snapshots, multi-form library.

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

### Architecture

- `src/core/` — pure TypeScript engines (no Vue/Pinia/Dexie): form model,
  `${field}` ↔ XPath expression rewriting, XForm serializer/parser, XLSForm
  reader/writer, validators. Everything here is unit-tested in Node.
- `src/stores/` — Pinia stores (form document + undo/redo + autosave,
  workspace library, preview orchestration).
- `src/persistence/` — Dexie/IndexedDB (forms, binary attachments, snapshots).
- `src/components/`, `src/views/` — the builder UI, styled with the design
  tokens `@getodk/web-forms` injects so builder and preview feel like one
  product (guarded by `tests/unit/theme-parity.spec.ts`).
- `tests/golden/` — XLSForm fixtures + pinned pyxform output; regenerate
  deliberately with `uv run --with openpyxl --with pyxform scripts/make-goldens.py`.

Product docs live in [`docs/product/`](docs/product/mission.md); each work
package has a spec folder under [`docs/specs/`](docs/specs/) and a browser
verification log under [`docs/verification/`](docs/verification/).

## License

See [LICENSE](LICENSE).
