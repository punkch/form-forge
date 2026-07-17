# Preview follows canvas selection — Implementation Plan

## Files

| File | Change |
| --- | --- |
| `src/preview/followSelection.ts` | NEW — pure matching/alignment module (no Vue/DOM imports; `@/core` model + registry only) |
| `src/preview/followSelection.spec.ts` | NEW — co-located node-env unit spec (vitest `unit` project already includes `src/preview/**/*.spec.ts`) |
| `src/components/preview/PreviewHost.vue` | forward OdkWebForm's `loaded` event (generation-guarded, DOM-ready); expose `followQuestion()`; flash CSS |
| `src/components/preview/PreviewPanel.vue` | wire `editor.selectedNodeId` watch + `@loaded` re-follow |
| `tests/e2e/preview-follow-selection.spec.ts` | NEW — Playwright coverage |

No core, store, persistence, or i18n changes. No new dependencies.

## Pure module API (contract — implement exactly this)

```ts
// src/preview/followSelection.ts
import type { FormDocument } from '@/core/model/types'

/** One question the preview is expected to render, in body order. */
export interface FollowEntry {
  /** Normalized, non-empty label texts across all languages. */
  labels: string[]
  /** Normalized, non-empty hint texts across all languages. */
  hints: string[]
  /** Matches any rendered question (label carries `${…}` output refs, or no label & no hint text at all). */
  wildcard: boolean
}

/** What PreviewHost extracts per rendered `.question-container`. */
export interface RenderedQuestion {
  /** Normalized textContent of `.control-text label`, '' when absent. */
  label: string
  /** Normalized textContent of `.control-text .hint`, '' when absent. */
  hint: string
}

export interface FollowTarget {
  entries: FollowEntry[]
  targetIndex: number
}

/** Collapse whitespace, trim, and strip markdown emphasis marks (` * _ ~ `)
 *  so authored markdown compares equal to web-forms' rendered text. */
export const normalizeText = (raw: string): string => …

/** Build the follow list and resolve the selected node to an index into it.
 *  A question resolves to itself; a group/repeat to its first renderable
 *  descendant question. Renderable = kind 'question' AND
 *  `getQuestionType(type)?.xform.bodyElement` is a non-null string
 *  (model-only types — calculate, metadata, actions — never render).
 *  Returns null when the selection doesn't resolve (unknown id, model-only
 *  question, container with no renderable descendant). */
export const buildFollowTarget = (doc: FormDocument, selectedNodeId: string): FollowTarget | null => …

/** Order-preserving alignment (LCS over a match predicate, skips allowed on
 *  BOTH sides) of expected entries vs rendered questions; returns the
 *  rendered index aligned to `targetIndex`, or null when the target is
 *  unaligned (e.g. hidden by relevance) or the DOM list is empty. */
export const resolveRenderedIndex = (
  entries: FollowEntry[],
  targetIndex: number,
  rendered: RenderedQuestion[],
): number | null => …
```

Details:

- **Entry building**: `flatten(doc.children)` (from `@/core/model/ops`) in
  body order, filtered to renderable questions. Per node: `labels` = all
  values of `node.label` (a `LocalizedText` record), normalized, deduped,
  empties dropped; `hints` likewise from `node.hint`. `wildcard` = any
  label/hint value contains `'${'`, OR both `labels` and `hints` end up
  empty.
- **Match predicate** (entry × rendered item): wildcard → true; rendered
  label non-empty → `entry.labels.includes(label)`; rendered label empty but
  hint non-empty → `entry.labels.length === 0 && entry.hints.includes(hint)`;
  both rendered texts empty → `entry.labels.length === 0 &&
  entry.hints.length === 0`.
- **Alignment**: classic DP LCS maximizing match count; deterministic
  backtrack preferring the earliest match (so a repeat's second instance
  aligns after, not instead of, its first). Form sizes are small — O(n·m)
  is fine. No fast path needed; unique labels are exact under LCS anyway.

## PreviewHost changes

- `emits` gains `loaded: []`. In `mountXml`'s `h(OdkWebForm, {…})` add
  `onLoaded: () => …` which, **guarded by `myGeneration === generation`**,
  emits after `nextTick` + one `requestAnimationFrame` (the engine emits
  `loaded` when state resolves, before the question DOM flushes).
- `defineExpose({ followQuestion })`:

```ts
const followQuestion = (target: FollowTarget, opts: { flash: boolean }): boolean
```

  1. Bail false when `mountEl` is null. Query
     `mountEl.querySelectorAll('.question-container')`; build
     `RenderedQuestion[]` via `normalizeText` on `.control-text label` /
     `.control-text .hint` textContent (first match per container).
  2. `resolveRenderedIndex`; null → return false.
  3. If the container is not fully inside the host's scroll viewport
     (compare `getBoundingClientRect` against the component root — the
     `.preview-host` element is the scroll container), call
     `el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' :
     'smooth' })` with `reduced` from
     `window.matchMedia('(prefers-reduced-motion: reduce)').matches`
     (pattern: `TreeNodeCard.vue`).
  4. When `opts.flash`: re-trigger-safe — remove the class, force reflow or
     use `animationend` cleanup (`{ once: true }`), then add
     `ff-follow-flash`. Return true.
- Flash CSS in the scoped style block via `.preview-mount :deep(…)`:
  `.question-container.ff-follow-flash` runs a background/box-shadow
  keyframe over `var(--builder-motion-duration-flash)`
  `var(--builder-motion-ease-standard)`. Mirror the canvas "just added"
  flash look (`TreeNodeCard.vue`) — accent-tinted, subtle. No literal
  timings (motion invariant). The global reduced-motion blanket zeroes it.

## PreviewPanel changes

```ts
const editor = useEditorStore()
const hostRef = ref<InstanceType<typeof PreviewHost> | null>(null)

const follow = (flash: boolean): void => {
  if (editor.selectedNodeId === null || form.doc === null) return
  const target = buildFollowTarget(form.doc, editor.selectedNodeId)
  if (target === null) return
  void nextTick(() => { hostRef.value?.followQuestion(target, { flash }) })
}

watch(() => editor.selectedNodeId, (id) => { if (id !== null) follow(true) })
```

Template: `<PreviewHost ref="hostRef" … @loaded="follow(false)" />`.

No retry timers: a selection made mid-load is picked up by the next
`loaded`. A false return from `followQuestion` is deliberately ignored.

## Tests

**Unit (`followSelection.spec.ts`)** — use the doc builders from
`tests/helpers` if they fit, else literal `FormDocument` fixtures:
- `normalizeText`: whitespace collapse, trim, emphasis-mark stripping.
- `buildFollowTarget`: question → its index; group/repeat → first renderable
  descendant; `calculate` excluded from entries AND as a direct target
  (null); labels from every language become candidates; `${ref}` label →
  wildcard; no-label-no-hint → wildcard; unknown id → null.
- `resolveRenderedIndex`: exact unique label; duplicate labels resolved
  positionally; entries hidden by relevance (DOM subsequence); extra DOM
  items from a second repeat instance (tail stays aligned); hint fallback
  when labels are empty; wildcard entries anchored by neighbors; target
  missing from DOM → null; empty DOM → null.

**e2e (`preview-follow-selection.spec.ts`)** — mirror `preview.spec.ts` /
`helpers.ts` conventions: build a form tall enough to overflow the preview
pane (a dozen text questions), wait for the preview to render, click a
late canvas card → expect its `.question-container` (`filter({ hasText })`
inside the preview pane) `toBeInViewport()`; click an early card → expect
that one back in viewport. `toBeInViewport` auto-retries through the smooth
scroll. Don't assert the flash class (timing-flaky).

## Verification & delivery

1. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` + targeted
   `pnpm test:e2e preview` (NO `--` before the filter).
2. agent-browser manual pass (select far-down field → preview scrolls +
   flashes; type in label → preview stays on the field through remounts;
   duplicate labels; group selection; reduced-motion emulation) logged to
   `docs/verification/2026-07-17-preview-follow-selection/log.md` +
   screenshots.
3. `/code-review`, fix findings immediately.
4. Conventional commit (`feat(preview): follow canvas selection in the live
   preview`), no co-author trailer; README Features + roadmap + CLAUDE.md
   sweep in the same change.
