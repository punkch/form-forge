# Full workspace backup (Central config + opt-in credentials) — PROMOTED / DELIVERED

> **Promoted + delivered 2026-07-15 → `docs/specs/2026-07-15-1729-workspace-full-backup/`.**
> The full shaping now lives in the timestamped spec folder:
>
> - `shape.md` — problem, the three locked decisions, and the as-built design
>   (format v2, gather/restore, security).
> - `user-guide.md` — how to back up / restore, and the opt-in credential flow.
> - `references.md` — code + test index.
>
> **Delivered:** the whole-workspace backup is now **format v2** — it carries
> Central server config + publish targets by default, and (opt-in, with a
> warning, while the vault is unlocked) the credential vault + saved passwords.
> Single-form / shareable exports stay credential-free (format v1). This stub is
> kept only as a provenance breadcrumb.
