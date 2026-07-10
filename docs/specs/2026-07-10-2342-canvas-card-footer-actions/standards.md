# Skills & Conventions — Canvas card footer actions

## unops-toolkit:interface-craft (skill)

- **Source:** unops-toolkit plugin, `skills/interface-craft/SKILL.md`
  (+ `references/design-critique.md`).
- **Why it applies:** the user routed the proposal through a full
  five-lens critique before implementation; the critique's ranked
  findings are the requirements.
- **Key points:** geometry must be hover-invariant; visual weight must
  match semantic importance; motion is spring/fade-subtle and
  reduced-motion aware.

## unops-toolkit:code-review (skill)

- **Source:** unops-toolkit plugin.
- **Why it applies:** established delivery process — every work package
  gets a five-lens review post-implementation, findings fixed
  immediately, no plan mode.

## agent-browser (skill)

- **Why it applies:** delivery process requires a manual verification
  pass logged to `docs/verification/` with screenshots.

## Project invariants (CLAUDE.md)

- Preserve `data-testid`s (e2e helpers depend on them).
- UI strings only via vue-i18n — this change adds **no** new strings.
- Conventional commits; no co-author trailers (user global rule).
- Logical CSS properties (`margin-inline-start`, `border-inline-start`)
  for future RTL — already the file's idiom, keep it.
- Component tests run in happy-dom; CSS behavior (clamp removal,
  visibility) is verified via agent-browser, not unit tests.
