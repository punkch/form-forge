/**
 * The clipboard's wire format: a self-describing snapshot of a multi-node
 * selection (nodes + the choice lists they reach + enough language context
 * to remap on paste) that can be JSON-serialized into the transport layer
 * (localStorage buffer / system clipboard / native ClipboardEvent — all
 * app-level, src/clipboard/) and read back defensively from an untrusted
 * source (another tab, another app version, a paste from outside Form
 * Forge entirely). Pure TS — no Vue/Pinia/Dexie/vue-i18n imports.
 *
 * Deliberately excludes entities, settings and attachment BLOBS: filenames
 * only travel (missing files on paste surface via the established
 * Missing-rows/refs-warning UX, same as any other import path).
 * `sourceFormRecordId` is reserved for a future blob-copy stretch and isn't
 * acted on by anything today.
 */
import { hasText, isRecord } from '../util/guards'
import { topMostNodes, visit } from '../model/ops'
import { collectAttachmentReferences } from '../model/rename-attachment'
import { type ChoiceList, type FormDocument, type FormNode, type Lang } from '../model/types'

export const CLIPBOARD_KIND = 'formforge-nodes' as const
export const CLIPBOARD_VERSION = 1 as const

/** Buffer size above which the localStorage leg of the transport layer
 * (src/clipboard/buffer.ts) skips persisting and falls back to the
 * in-memory slot only. Lives here, not there, so the transport layer and
 * any future size-aware UI share one number. */
export const MAX_BUFFER_CHARS = 1_500_000

export interface NodesPayload {
  kind: typeof CLIPBOARD_KIND
  version: typeof CLIPBOARD_VERSION
  nodes: FormNode[]
  choiceLists: Record<string, ChoiceList>
  /** The source document's declared languages, or [] for a Shape A source —
   * mirrors doc.languages exactly, so the merge step can reconstruct
   * `langsOf`/`primaryLang` without the source doc itself traveling. */
  languages: Lang[]
  defaultLanguage?: Lang
  /** Every filename referenced anywhere in the copied subtrees + reachable
   * choice lists (itemsetFile incl. the implicit csv-external default,
   * image defaults, all 4 media kinds) — no blobs, filenames only. */
  attachmentFilenames: string[]
  /** Reserved for a future blob-copy stretch; not read by anything today. */
  sourceFormRecordId?: string
  copiedAt: number
}

/**
 * Snapshot the top-most selected nodes (a selected container implies its
 * already-selected descendants) plus the choice lists they reach — nothing
 * else. Returns null for an empty/unknown selection, same "nothing to act
 * on" convention as the rest of the multi-select surface.
 */
export const buildNodesPayload = (
  doc: FormDocument,
  ids: Iterable<string>,
  meta: { sourceFormRecordId?: string } = {}
): NodesPayload | null => {
  const top = topMostNodes(doc, ids)
  if (top.length === 0) return null

  // JSON round-trip, same proxy-safe clone as cloneSubtree (ops.ts): the
  // model is plain data, and this stays transparent to Vue's reactive
  // proxies (which structuredClone refuses to clone) and detaches the
  // payload from the live doc entirely.
  const nodes = JSON.parse(JSON.stringify(top)) as FormNode[]

  // Reachable choice lists only — every listRef used anywhere in the copied
  // subtrees, never the whole document's list.
  const listNames = new Set<string>()
  visit(nodes, (node) => {
    if (node.kind === 'question' && node.listRef !== undefined) listNames.add(node.listRef)
    return undefined
  })
  const choiceLists: Record<string, ChoiceList> = {}
  for (const name of listNames) {
    const list = doc.choiceLists[name]
    if (list !== undefined) choiceLists[name] = JSON.parse(JSON.stringify(list)) as ChoiceList
  }

  // A synthetic doc lets buildNodesPayload reuse the SAME traversal the rest
  // of the app uses for "what does this document reference" — the implicit
  // csv-external default, image defaults and all 4 media kinds on both
  // nodes and choices, always agreeing with the Attachments dialog / refs
  // validator on what "referenced" means.
  const synthetic: FormDocument = {
    schemaVersion: 1,
    settings: {},
    languages: doc.languages,
    children: nodes,
    choiceLists,
    attachments: [],
  }
  const attachmentFilenames = [...collectAttachmentReferences(synthetic).keys()]

  return {
    kind: CLIPBOARD_KIND,
    version: CLIPBOARD_VERSION,
    nodes,
    choiceLists,
    languages: [...doc.languages],
    defaultLanguage: doc.settings.defaultLanguage,
    attachmentFilenames,
    sourceFormRecordId: meta.sourceFormRecordId,
    copiedAt: Date.now(),
  }
}

export const serializeNodesPayload = (payload: NodesPayload): string => JSON.stringify(payload)

const readOptionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && hasText(value) ? value : undefined

/** Deep-enough node shape check that the merge's traversals (name-dedup
 * walk, localized-text sub-walkers, container recursion) can run without
 * deref crashes: a correctly-tagged but mangled EXTERNAL payload must be
 * rejected here — the merge runs inside a `mutate()` that has already
 * pushed its undo snapshot, so throwing there would strand a dead entry. */
const isSaneNode = (value: unknown): boolean => {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return false
  if (!isRecord(value.bind) || !isRecord(value.body)) return false
  if (value.kind === 'question') return typeof value.type === 'string'
  if (value.kind === 'group' || value.kind === 'repeat') {
    return Array.isArray(value.children) && value.children.every(isSaneNode)
  }
  return false
}

const isSaneChoiceList = (value: unknown): boolean =>
  isRecord(value) && typeof value.name === 'string' && Array.isArray(value.choices) &&
  value.choices.every((choice) => isRecord(choice) && typeof choice.name === 'string')

/**
 * Defensive parse of untrusted JSON-parsed data (another tab, an older/newer
 * app build, or plain garbage): structural field checks only, no throw.
 * Rejects any `version` above CLIPBOARD_VERSION — a payload written by a
 * newer app build is refused rather than misread, same posture as the
 * workspace archive's formatVersion gate.
 */
export const parseNodesPayload = (raw: unknown): NodesPayload | null => {
  if (!isRecord(raw)) return null
  if (raw.kind !== CLIPBOARD_KIND) return null
  if (typeof raw.version !== 'number' || raw.version < 1 || raw.version > CLIPBOARD_VERSION) return null
  if (!Array.isArray(raw.nodes) || !raw.nodes.every(isSaneNode)) return null
  if (!isRecord(raw.choiceLists) || !Object.values(raw.choiceLists).every(isSaneChoiceList)) return null
  if (!Array.isArray(raw.languages) || !raw.languages.every((lang) => typeof lang === 'string')) return null
  if (!Array.isArray(raw.attachmentFilenames) || !raw.attachmentFilenames.every((f) => typeof f === 'string')) return null
  if (typeof raw.copiedAt !== 'number') return null

  return {
    kind: CLIPBOARD_KIND,
    version: CLIPBOARD_VERSION,
    nodes: raw.nodes as FormNode[],
    choiceLists: raw.choiceLists as Record<string, ChoiceList>,
    languages: raw.languages as Lang[],
    defaultLanguage: readOptionalString(raw.defaultLanguage),
    attachmentFilenames: raw.attachmentFilenames as string[],
    sourceFormRecordId: readOptionalString(raw.sourceFormRecordId),
    copiedAt: raw.copiedAt,
  }
}

/** Cheap sniff before the (relatively expensive, throwable) JSON.parse: does
 * this text look like one of ours at all? Lets callers skip parsing large
 * amounts of unrelated clipboard text (a screenshot's alt text, a code
 * snippet, ...) without ever touching JSON.parse. */
const looksLikeClipboardPayload = (text: string): boolean =>
  text.includes('{') && text.includes(`"${CLIPBOARD_KIND}"`)

/**
 * Never throws: a real ClipboardEvent or localStorage read can hand back
 * anything (huge text, truncated JSON, someone else's app's payload). Sniffs
 * first, then wraps JSON.parse + parseNodesPayload's own guards.
 */
export const tryParseClipboardText = (text: string): NodesPayload | null => {
  if (!looksLikeClipboardPayload(text)) return null
  try {
    return parseNodesPayload(JSON.parse(text))
  } catch {
    return null
  }
}
