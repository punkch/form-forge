# Spec 01: Product Docs & Foundation — Shaping Notes

## Scope

First work package of the odk-builder rebuild: refreshed product documentation, a fresh Vue 3 + TypeScript scaffold with updated packages, the core form model and question-type registry, ODK Web Forms styling foundation, app shell with routing, IndexedDB persistence, and the Form Library view. See `plan.md` for the full approved program (8 specs).

## Decisions

- **Fresh rebuild** in this repo; prototype preserved in git history. Registry (`src/components/field-type-registry.ts`) and tree helpers (`FieldInstance.ts`) are ported, everything else rewritten.
- **Purely client-side**: browser storage only (Dexie/IndexedDB); no backend, ever.
- **Exports**: XForm XML, XLSForm (.xlsx), ZIP with attachments. **Imports**: XForm XML, XLSForm.
- **Native TypeScript XLSForm engine** (no pyxform/Pyodide); pyxform is the behavioral reference via golden tests.
- **Full XLSForm question-type list** (~40 types) in scope.
- **Design**: match ODK Web Forms via its injected `--odk-*`/`--p-*` CSS tokens. The Material Design 3 / Figma design in TECHNICAL_SPECIFICATION.md is superseded. Dark mode out of scope.
- **Layout**: responsive split view (canvas + properties + toggleable preview); tablet-capable; <768px unsupported banner.
- **PrimeVue strategy**: host pins exactly `primevue@4.3.3` + `@primeuix/themes@1.0.3` (what web-forms 1.0.0 bundles); `webFormsPlugin` is never installed on the host app — preview mounts in a child Vue app.
- **TypeScript ~5.9.x** (not 7.x) for vue-tsc compatibility.
- Docs live in `docs/` (this tree);

## Context

- **Visuals:** None provided; visual reference is the ODK Web Forms UI itself (its injected tokens and a live preview render).
- **References:** prototype `src/components/*` (registry, FieldInstance, XFormBuilder for behaviors being replaced), `node_modules/@getodk/web-forms/dist/index.js` (styling/integration ground truth), `test-forms/` fixtures, `xlsform-cheatsheet/`.
- **Product alignment:** mission (visual ODK form authoring without XML knowledge) unchanged; delivery model pivots to local-first static site. `docs/product/` is the refreshed source of truth.

## Skills & Conventions Applied

- unops-toolkit:plan-product — produces `docs/product/` (mission, roadmap, tech stack)
- unops-toolkit:shape-spec — this folder's structure; repeated per spec
- agent-browser — end-of-spec verification in a real browser (`docs/verification/`)
- neostandard ESLint + strict TypeScript + Vitest/Playwright per REQUIREMENTS.md testing strategy
