# Verification — Range preview crash fix (2026-07-10)

Manual agent-browser pass against the production build (`pnpm build` +
`pnpm preview`, chromium 1440×900). Spec:
`docs/specs/2026-07-10-1945-range-preview-crash/`.

## Automated gates
- `pnpm lint`, `pnpm typecheck` — clean
- `pnpm test` — 82 files / 736 tests pass
- `tests/golden/` — unmoved (serializer range goldens already specify bounds)

## In-app checks

| Scenario | Evidence | Result |
|---|---|---|
| Fresh `range` question (no `step`) renders in the preview | `v12-range-preview.webp` | ✅ 1–10 slider, no error dialog (previously crashed) |
| Range with a non-numeric bound (`start="abc"`) | `v13-bad-range-recovered.webp` | ✅ builder's own recoverable error state ("The preview couldn't load this version of the form", Show details / Retry / Open full-page) instead of web-forms' undismissable dialog |
| Error detail surfaces the engine message | (read inline) | ✅ "Expected attribute start to be defined with numeric string, got: \"abc\"" |

## Notes
- The serializer default (start=1/end=10/step=1 from the registry) means the
  original reported crash (range missing bounds) no longer reaches the engine
  error path at all — it just loads.
- The failure-dialog detection is the safety net for other engine load
  failures; verified it does not misfire on a healthy form (v12 loads clean).
