/**
 * Matches the builder's model nodes to web-forms' rendered
 * `.question-container` DOM by label/hint text, because the engine mints its
 * own opaque node ids and the field ref never reaches the DOM (see
 * references.md). Position (LCS alignment) breaks ties among duplicate or
 * blank labels — a repeat renders the same label once per instance, and
 * model-only questions carry no visible text at all. Wildcard entries
 * (dynamic `${…}` labels, or no label/hint) match any rendered item
 * positionally, since their real text can't be predicted ahead of
 * evaluation.
 */
import { flatten, findNode } from '@/core/model/ops'
import { isContainer, type FormDocument, type FormNode, type LocalizedText, type QuestionNode } from '@/core/model/types'
import { getQuestionType } from '@/core/registry/question-types'

/** One question the preview is expected to render, in body order. */
export interface FollowEntry {
  /** Normalized, non-empty label texts across all languages. */
  labels: string[]
  /** Normalized, non-empty hint texts across all languages. */
  hints: string[]
  /** Matches any rendered question (label carries `${…}` output refs, or no label and no static hint at all). */
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
export const normalizeText = (raw: string): string =>
  raw.replace(/[*_~]/g, '').replace(/\s+/g, ' ').trim()

/** A question renders in the preview iff its type maps to a real body
 *  element — model-only types (calculate, metadata, actions) declare
 *  `xform.bodyElement: null` and never reach the DOM. */
const isRenderable = (node: FormNode): node is QuestionNode =>
  node.kind === 'question' && typeof getQuestionType(node.type)?.xform.bodyElement === 'string'

/** Normalized, de-duplicated, non-empty values across every language. */
const candidateTexts = (text: LocalizedText | undefined): string[] => {
  const out: string[] = []
  for (const value of Object.values(text ?? {})) {
    if (value === undefined) continue
    const normalized = normalizeText(value)
    if (normalized !== '' && !out.includes(normalized)) out.push(normalized)
  }
  return out
}

const hasFieldRef = (values: string[]): boolean => values.some((v) => v.includes('${'))

const buildEntry = (node: QuestionNode): FollowEntry => {
  const labels = candidateTexts(node.label)
  // A `${…}` hint renders as a live value and can never text-match, but a
  // static label alongside it still can — drop only the hint candidates
  // instead of wildcarding the whole entry.
  const hints = candidateTexts(node.hint).filter((v) => !v.includes('${'))
  return {
    labels,
    hints,
    wildcard: hasFieldRef(labels) || (labels.length === 0 && hints.length === 0),
  }
}

/** Build the follow list and resolve the selected node to an index into it.
 *  A question resolves to itself; a group/repeat to its first renderable
 *  descendant question. Returns null when the selection doesn't resolve
 *  (unknown id, model-only question, container with no renderable
 *  descendant). */
export const buildFollowTarget = (doc: FormDocument, selectedNodeId: string): FollowTarget | null => {
  const renderable = flatten(doc.children).filter(isRenderable)
  const entries = renderable.map(buildEntry)

  const selected = findNode(doc, selectedNodeId)
  if (selected === null) return null

  const targetNode = isContainer(selected)
    ? flatten(selected.children).find(isRenderable) ?? null
    : (isRenderable(selected) ? selected : null)
  if (targetNode === null) return null

  const targetIndex = renderable.findIndex((n) => n.id === targetNode.id)
  return targetIndex === -1 ? null : { entries, targetIndex }
}

/** Whether a rendered question can stand for an expected entry. */
const isMatch = (entry: FollowEntry, item: RenderedQuestion): boolean => {
  if (entry.wildcard) return true
  if (item.label !== '') return entry.labels.includes(item.label)
  if (item.hint !== '') return entry.labels.length === 0 && entry.hints.includes(item.hint)
  return entry.labels.length === 0 && entry.hints.length === 0
}

/** Order-preserving alignment (LCS over a match predicate, skips allowed on
 *  BOTH sides) of expected entries vs rendered questions; returns the
 *  rendered index aligned to `targetIndex`, or null when the target is
 *  unaligned (e.g. hidden by relevance) or the DOM list is empty. */
export const resolveRenderedIndex = (
  entries: FollowEntry[],
  targetIndex: number,
  rendered: RenderedQuestion[]
): number | null => {
  if (rendered.length === 0 || targetIndex < 0 || targetIndex >= entries.length) return null

  const n = entries.length
  const m = rendered.length
  // suf[i][j] = best match count between entries[i..] and rendered[j..];
  // pre[i][j] = best match count between entries[..i) and rendered[..j).
  // Form sizes are small — O(n·m) is fine, no fast path needed.
  const suf: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const matchScore = isMatch(entries[i], rendered[j]) ? suf[i + 1][j + 1] + 1 : 0
      suf[i][j] = Math.max(matchScore, suf[i + 1][j], suf[i][j + 1])
    }
  }
  const pre: number[][] = Array.from({ length: targetIndex + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 1; i <= targetIndex; i++) {
    for (let j = 1; j <= m; j++) {
      const matchScore = isMatch(entries[i - 1], rendered[j - 1]) ? pre[i - 1][j - 1] + 1 : 0
      pre[i][j] = Math.max(matchScore, pre[i - 1][j], pre[i][j - 1])
    }
  }

  // Anchor on the target instead of tracing one canonical alignment: the
  // answer is the earliest j the target can match while still lying on SOME
  // optimal global alignment. This keeps a preceding skippable wildcard from
  // stealing the target's item on a tie, and "earliest j" keeps a repeat's
  // later instances from shadowing its first.
  for (let j = 0; j < m; j++) {
    if (!isMatch(entries[targetIndex], rendered[j])) continue
    if (pre[targetIndex][j] + 1 + suf[targetIndex + 1][j + 1] === suf[0][0]) return j
  }
  return null
}
