# Standards — renovate-dependency-updates

- **Conventional commits**: Renovate PR titles use
  `:semanticPrefixFixDepsChoreOthers` — `fix(deps):` for runtime
  dependencies (visible in the release-please changelog), `chore(deps):`
  for the rest (hidden section).
- **No secrets in the repo**: the PAT lives only in the `RENOVATE_TOKEN`
  repository secret; the workflow file documents the required permissions
  but contains no identifying values.
- **Repo-name-agnostic workflows**: `RENOVATE_REPOSITORIES` derives from
  `${{ github.repository }}` (same rule as `deploy.yml`'s BASE_PATH — no
  hardcoded owner/name).
- **Least privilege**: `permissions: {}` on the workflow; all write access
  comes from the scoped PAT.
- **Version pins with reasons**: every disabled/limited package rule
  carries a `description` naming its rationale, mirroring
  `docs/product/tech-stack.md`.
- **Manual merge**: automerge stays off until the pipeline has proven
  itself over several cycles (recorded in `shape.md`).
