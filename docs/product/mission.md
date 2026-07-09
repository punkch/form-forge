# Product Mission

## Problem

Creating ODK data-collection forms requires either hand-writing XForm XML or mastering XLSForm spreadsheet conventions — expression syntax, translation columns, cascading select mechanics, binding rules. Field teams at NGOs, research institutions, and government agencies routinely lose time to conversion errors, invalid forms discovered only at deployment, and tooling that requires a hosted backend (XLSForm Online, KoBo) or is deprecated (ODK Build). There is no modern, offline-capable, install-free tool that lets a non-technical author build a valid ODK form and see it exactly as respondents will.

## Target Users

- **NGO program managers and M&E officers** who design household surveys and monitoring instruments without an engineering team.
- **Academic researchers** who iterate quickly on study instruments and need multi-language support.
- **Government and agency data teams** with data-sovereignty constraints — a tool that never sends form definitions to a server is a requirement, not a nicety.
- **ODK consultants and power users** who work in XLSForm today and want faster authoring with reliable round-tripping back to their existing files.

## Solution

A **purely client-side** visual form builder that runs as a static web page and stores everything in the browser (IndexedDB). No accounts, no server, no data leaves the machine.

Key differentiators:

1. **Real preview, not a mock** — the form renders live in the official `@getodk/web-forms` engine, so what the author sees is exactly what ODK Central serves. The builder UI adopts ODK Web Forms' own design tokens, so authoring and preview feel like one product.
2. **First-class round-tripping** — imports existing XForm XML and XLSForm (.xlsx) files losslessly (unknown columns and XML constructs are preserved), and exports XForm XML, XLSForm, or a ZIP with media/CSV attachments ready for ODK Central. The XLSForm converter runs natively in the browser — the first of its kind (everything else in the ecosystem calls Python's pyxform on a server).
3. **Full XLSForm surface** — the complete question-type list (~40 types), shared choice lists, cascading selects, multi-language translations, expressions with `${field}` autocompletion, groups/repeats, entities.
4. **Local-first reliability** — autosave, undo/redo, crash recovery, and multi-form library, all offline.
