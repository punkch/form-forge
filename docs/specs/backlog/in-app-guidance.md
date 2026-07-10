# In-app guidance for workflow features — shaping (backlog)

## Problem

The help system covers *things* (question types, property fields: typed
registry in `src/help/content.ts` → i18n catalog, `HelpPopover`, type-help
drawer) but not *workflows*. Features whose value lives in a multi-step or
cross-panel flow are invisible unless you already know them:

- **Translations** — "Show in editor" silently retargets which language the
  properties panel edits; the grid hides empty sites; ODK has no fallback
  language. (Prompted this proposal; structural fixes shaped separately in
  [translation-coverage](translation-coverage.md), but the *concepts* still
  need explaining.)
- **Visual logic builder** — expressions the builder can't represent stay in
  the raw editor; why the toggle is sometimes disabled is unexplained.
- **External datasets** — CSV/GeoJSON uploads feed itemsets/`pulldata()`;
  the 500-row preview cap and unknown-column warnings surprise users.
- **Entities** — dataset declaration vs `save_to` vs the follow-up wizard
  is a three-part flow with no in-app narrative.
- **Workspace backup / templates / crash snapshots** — lossless
  `.formforge.zip`, save-as-template, autosave + snapshot recovery exist
  but are only discoverable by menu-spelunking.
- **Tree keyboard commands** and **PWA install/update behavior** — no
  in-app mention at all.

## Scope

- A third help category, **workflow guides**: task-oriented, step-numbered
  content in the same typed-registry → i18n-catalog pattern
  (`guideHelp` in `src/help/content.ts`, text in `locales/en/help.json`).
- **Guides section in the existing help drawer** — listed alongside the
  question-type reference, searchable via the shared `groupTypesBySearch`
  machinery (extended to guides), each with an optional deep link to
  docs.getodk.org.
- **Contextual entry points**: a "?" affordance in the header of the
  feature's home surface (Translations dialog, logic builder, dataset and
  entity sections, library toolbar for backup/templates) opening its guide
  directly.
- **Dismissable first-use callouts** for the two worst traps: the
  Translations dialog (display-language retargeting, no fallback language)
  and the logic builder's raw-mode fallback. Dismissal persisted in the
  `ui` store like other prefs.
- Everything bundled and offline; no fetches, no telemetry (invariants).

Out of scope: guided tours / coach-mark overlays (heavy, a11y-hard),
videos, embed-API host documentation (developer-facing, stays in
`docs/specs/.../user-guide.md` and the demo host page).

## Approach

- `src/help/content.ts` grows `guideHelp: Record<GuideKey, GuideHelp>`
  where `GuideHelp` = title, summary, steps (array of MessageKeys), and an
  optional `docsUrl`; vue-tsc validates every catalog key as today.
- New `GuideContent.vue` + a drawer tab/section in
  `QuestionTypeHelpDrawer.vue` (or a sibling drawer sharing its shell);
  `HelpPopover`-style trigger component variant that opens the drawer at a
  guide (`data-testid` per guide for e2e).
- Callout component: inline dismissable panel keyed by guide, visibility
  from `ui` store persisted prefs (`dismissedCallouts: GuideKey[]`).
- Content adapted from the delivered specs' `user-guide.md` files — the
  writing largely exists; this feature moves it from docs into the app.

## Decisions (proposed)

- v1 guide list (8): translations, logic builder, datasets, entities +
  follow-up wizard, workspace backup, templates, autosave & snapshots,
  keyboard commands. PWA install/update deferred (browser-dependent UX).
- Callouts only where a silent behavior changes user data (translations,
  raw-mode logic); everything else is pull-based via "?" triggers — no
  popup fatigue.
- Same-catalog i18n (`help.json` namespace) so guides translate with the
  rest of the UI; English stays byte-stable except the new keys.

## Open questions

- Drawer information architecture: one drawer with tabs (Types | Guides)
  vs a separate guides drawer? Tabs keep one entry point but the type
  drawer is currently type-search-shaped.
- Should guide steps render lightweight inline screenshots/diagrams
  (bundled assets, size cost for the PWA precache) or stay text-only in v1?
- Do contextual "?" triggers deep-link into a specific step when opened
  from a sub-surface (e.g. the grid's empty state → "add a language" step)?

## Acceptance

Help drawer lists the v1 guides and finds them by search; the Translations
dialog header "?" opens the translations guide; the first open of the
Translations dialog shows a dismissable callout explaining display-language
retargeting and the no-fallback rule, and the dismissal survives reload;
all guide strings live in the i18n catalog (`no-missing-keys` clean, byte-
stable English elsewhere); e2e covers drawer-open → search → guide render
and one contextual trigger; PWA precache still passes size expectations.
