# Attachment manager: rename, per-row replace, conflict handling — PROMOTED

> **Promoted 2026-07-16 → `docs/specs/2026-07-16-1123-attachment-manager/`.**
> This proposal has moved into implementation. The full shaping and plan now
> live in the timestamped spec folder:
>
> - `plan.md` — full implementation plan (the must-fix DataCloneError
>   save-poisoning bug first as its own commit, then rename with doc-wide
>   reference rewriting, per-row replace, explicit conflict handling with
>   apply-to-all, missing-required-attachment rows, orphan sweep on open).
> - `shape.md` — scope + the resolved decisions (modal rename with locked
>   extension, unique filenames via numeric keep-both suffixes,
>   reference-count badges, implicit csv-external refs auto-materialized,
>   Missing rows added by the user post-promotion).
> - `standards.md`, `references.md`, `user-guide.md`.
>
> This stub is kept only as a provenance breadcrumb.
