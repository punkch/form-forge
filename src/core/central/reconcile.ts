/**
 * Reconcile one publish target against the current form and, optionally, a
 * Central forms-list summary — the pure decision layer behind the drawer's
 * per-destination freshness chip and its "Check server" affordance.
 *
 * Two independent questions, deliberately kept separate:
 *
 * - `freshnessFor` — a purely *local* comparison: has the form changed since it
 *   was last published to this destination? It diffs the current content
 *   fingerprint (SHA-256 hex from `fingerprint.ts`) against the one remembered
 *   on the target. No network, no Central state involved. A missing remembered
 *   hash (an older target, or a destination never reconciled) is `'unknown'`
 *   rather than a guess.
 *
 * - `reconcileTarget` — a *remote* comparison against what Central actually
 *   holds. The caller does the network fetch (`client.listForms`) and hands the
 *   resulting summaries in; this function only matches by `xmlFormId` and
 *   compares versions. A published form always carries a non-null `publishedAt`,
 *   so a summary that is absent — or present but still a never-published draft —
 *   reads as `'never-published'`.
 *
 * Pure core — no Vue/Pinia/Dexie/vue-i18n imports. The UI maps these verdicts to
 * localized copy; core never localizes.
 */
import type { CentralFormSummary } from './types'

/** Local content freshness of a target relative to the current form. */
export type FreshnessState = 'fresh' | 'changed' | 'unknown'

/**
 * Local freshness: did I change the form since I last published to this target?
 *
 * `currentHash` / `lastPublishedContentHash` are SHA-256 hex digests from
 * `src/core/central/fingerprint.ts`. A missing `lastPublishedContentHash`
 * (never recorded) yields `'unknown'`; matching hashes are `'fresh'`; any
 * difference is `'changed'`.
 */
export const freshnessFor = (
  currentHash: string,
  lastPublishedContentHash: string | undefined
): FreshnessState => {
  if (lastPublishedContentHash === undefined) return 'unknown'
  return currentHash === lastPublishedContentHash ? 'fresh' : 'changed'
}

/** The outcome of comparing a target against Central's live forms list. */
export type ReconcileVerdict =
  | { kind: 'matches' }
  | { kind: 'version-differs'; centralVersion: string }
  | { kind: 'never-published' }
  | { kind: 'error' }

/**
 * Reconcile a target against Central's forms list (published forms only carry a
 * non-null `publishedAt`). `summaries` is what `client.listForms` returned for
 * the target's project; the matching entry is the one whose `xmlFormId` equals
 * the target's.
 *
 * - none found, OR found but `publishedAt === null` → `'never-published'`
 * - found and `version === lastPublishedVersion` → `'matches'`
 * - found and `version` differs → `'version-differs'` carrying Central's version
 *
 * The `'error'` verdict is reserved for the caller to signal a fetch failure;
 * this function never returns it.
 */
export const reconcileTarget = (
  target: { xmlFormId: string; lastPublishedVersion: string },
  summaries: CentralFormSummary[]
): ReconcileVerdict => {
  const match = summaries.find((summary) => summary.xmlFormId === target.xmlFormId)
  if (match === undefined || match.publishedAt === null) return { kind: 'never-published' }
  const centralVersion = match.version ?? ''
  if (centralVersion === target.lastPublishedVersion) return { kind: 'matches' }
  return { kind: 'version-differs', centralVersion }
}
