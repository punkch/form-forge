/**
 * Cross-doc merge of a clipboard NodesPayload into a target document — the
 * shared primitive behind both paste and insert-from-template ("someone
 * else's nodes, safely rehomed here" is the same problem either way). Deep-
 * clones the payload up front so it stays reusable across repeated pastes,
 * remaps languages onto the target's own declared set, imports/dedupes/
 * reuses choice lists, mints fresh ids + deduped names, strips `saveTo` when
 * the target declares no entities, then inserts sequentially. Pure TS — no
 * Vue/Pinia/Dexie/vue-i18n imports.
 */
import { newId } from '../model/ids'
import { allNames, findNode, insertNode, uniqueNameIn, visit } from '../model/ops'
import {
  langsOf,
  matchLanguage,
  primaryLang,
  resolvePrimaryLang,
  transformChoiceListsLocalizedTexts,
  transformNodesLocalizedTexts,
} from '../model/translations'
import {
  DEFAULT_LANG,
  isContainer,
  type ChoiceList,
  type FormDocument,
  type FormNode,
  type Lang,
  type LocalizedText,
} from '../model/types'
import { effectiveItemsetFile } from '../registry/question-types'
import type { NodesPayload } from './payload'

export interface MergeTarget {
  /** null = document root. */
  parentId: string | null
  /** Insertion index within the parent's children (append when omitted). */
  index?: number
}

export interface MergeResult {
  /** Fresh ids of the top-level inserted nodes, in document order. */
  insertedIds: string[]
  addedLists: string[]
  reusedLists: string[]
  renamedLists: { from: string, to: string }[]
  /** Source languages that matched no target language and weren't the
   * source's own primary — their text stays in place DORMANT (invisible
   * until the user declares a matching language, which adopts it — see
   * adoptDormantTranslations in model/translations.ts). */
  dormantLanguages: Lang[]
  strippedSaveTo: number
  /** Passed through from the payload verbatim, for an informational toast —
   * missing files still surface via the normal Missing-rows/refs UX. */
  attachmentFilenames: string[]
}

/**
 * One Map<sourceLang, targetLang | null> covering every language key the
 * payload's texts can carry (its declared languages, or the DEFAULT_LANG
 * sentinel for a Shape A source). Match order (matchLanguage, shared with
 * adoptDormantTranslations): exact key → same code (case-insensitive) →
 * same name part → the source's own primary language falls back to the
 * target's primary → otherwise null = kept DORMANT under its own key.
 * Every non-null result is one of the target's OWN declared languages (or
 * its sentinel) and dormant keys are named languages, never the sentinel —
 * so the two-clean-shapes invariant (about sentinel content only) holds by
 * construction, not by a follow-up check.
 */
const buildLanguageRemap = (payload: NodesPayload, doc: FormDocument): Map<Lang, Lang | null> => {
  const sourceLangs = payload.languages.length > 0 ? payload.languages : [DEFAULT_LANG]
  const targetLangs = langsOf(doc)
  const targetSet = new Set(targetLangs)
  // The source doc itself never travels with the payload — resolve its
  // primary from the payload's languages/defaultLanguage fields.
  const sourcePrimary = resolvePrimaryLang(payload.languages, payload.defaultLanguage)
  const targetPrimary = primaryLang(doc)

  const remap = new Map<Lang, Lang | null>()
  for (const source of sourceLangs) {
    if (targetSet.has(source)) { remap.set(source, source); continue }
    const match = matchLanguage(source, targetLangs)
    if (match !== undefined) { remap.set(source, match); continue }
    remap.set(source, source === sourcePrimary ? targetPrimary : null)
  }
  return remap
}

/** Rewrite one LocalizedText's keys per the remap. A key mapped to null
 * (unmatched non-primary language) is KEPT under its own key — dormant text
 * a later addLanguage can adopt. A key ABSENT from the map is sentinel
 * debris from a mixed-shape source and is dropped: retaining it would seed
 * the target with unassigned text and break the two-clean-shapes invariant.
 * When two source keys land on the same target key the first one written
 * wins — in practice at most one source key maps to any given target key
 * (see the table above), so this only guards a degenerate edge case. */
const remapText = (text: LocalizedText, remap: Map<Lang, Lang | null>): LocalizedText | undefined => {
  const next: LocalizedText = {}
  for (const [key, value] of Object.entries(text)) {
    if (value === undefined || value === '') continue
    const target = remap.get(key)
    if (target === undefined) continue
    if (target === null) {
      if (next[key] === undefined) next[key] = value
      continue
    }
    if (next[target] === undefined) next[target] = value
  }
  return Object.keys(next).length === 0 ? undefined : next
}

/** Structural equality that ignores object key order (LocalizedText/Choice
 * key insertion order is incidental, never semantic). Array element order
 * IS preserved/compared — choice order matters. */
const deepEqualIgnoringKeyOrder = (a: unknown, b: unknown): boolean => {
  const canonicalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonicalize)
    if (value !== null && typeof value === 'object') {
      const sorted: Record<string, unknown> = {}
      for (const key of Object.keys(value as Record<string, unknown>).sort()) {
        sorted[key] = canonicalize((value as Record<string, unknown>)[key])
      }
      return sorted
    }
    return value
  }
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b))
}

/**
 * Materialize a csv-external question's implicit itemset default
 * (`${name}.csv`) into an explicit `itemsetFile` before the node is renamed
 * for uniqueness — the implicit default is name-derived, so renaming first
 * would silently retarget which attachment the question reads.
 */
const materializeImplicitItemsetFile = (node: FormNode): void => {
  if (node.kind !== 'question') return
  if (node.itemsetFile !== undefined) return
  const implicit = effectiveItemsetFile(node)
  if (implicit !== undefined) node.itemsetFile = implicit
}

/** Fresh id + deduped name for one cloned subtree, dedup seeded from a
 * caller-owned, growing Set — N siblings sharing a base name land on
 * distinct suffixes (uniqueNameIn's whole reason for existing; a fresh
 * `uniqueName(doc, base)` call per sibling would have them collide, since
 * none of them are in the doc yet to conflict with each other). */
const rehome = (node: FormNode, names: Set<string>): void => {
  materializeImplicitItemsetFile(node)
  node.id = newId()
  node.name = uniqueNameIn(names, node.name)
  names.add(node.name)
  if (isContainer(node)) for (const child of node.children) rehome(child, names)
}

/**
 * Merge a clipboard payload into `doc` at `target`. Returns null — doc left
 * completely untouched — for an empty payload or an invalid target (parent
 * id not found, or not a container); every other failure mode degrades
 * gracefully (dormant languages, stripped saveTo, renamed lists) and is
 * reported on the result instead. Step order: validate target → clone →
 * language remap → choice-list import (+ listRef rewrite) → fresh ids/names
 * → saveTo policy → sequential insert.
 */
export const mergeNodesIntoDoc = (
  doc: FormDocument,
  payload: NodesPayload,
  target: MergeTarget
): MergeResult | null => {
  if (payload.nodes.length === 0) return null
  if (target.parentId !== null) {
    const parent = findNode(doc, target.parentId)
    if (parent === null || !isContainer(parent)) return null
  }

  // The payload is immutable (repeat pastes reuse it) — deep-clone before
  // touching anything, same JSON round-trip precedent as cloneSubtree.
  const nodes = JSON.parse(JSON.stringify(payload.nodes)) as FormNode[]
  const lists = JSON.parse(JSON.stringify(payload.choiceLists)) as Record<string, ChoiceList>

  const remap = buildLanguageRemap(payload, doc)

  // Which languages does the copied content ACTUALLY carry text in? Collected
  // before the remap so `dormantLanguages` reports real dormant content, not
  // a source language that was declared but unused by these subtrees.
  const usedLangs = new Set<Lang>()
  const collectLangs = (text: LocalizedText): LocalizedText => {
    for (const [key, value] of Object.entries(text)) {
      if (value !== undefined && value !== '') usedLangs.add(key)
    }
    return text
  }
  transformNodesLocalizedTexts(nodes, collectLangs)
  transformChoiceListsLocalizedTexts(Object.values(lists), collectLangs)

  const remapFn = (text: LocalizedText): LocalizedText | undefined => remapText(text, remap)
  transformNodesLocalizedTexts(nodes, remapFn)
  transformChoiceListsLocalizedTexts(Object.values(lists), remapFn)
  const dormantLanguages = [...remap.entries()]
    .filter(([source, mapped]) => mapped === null && usedLangs.has(source))
    .map(([source]) => source)

  // Choice-list import: absent → add, present + deep-equal post-remap →
  // reuse, present + different → rename (never union-merge, never
  // overwrite). Recomputing Object.keys(doc.choiceLists) each iteration
  // means a rename this loop already made is itself collision-checked
  // against by the next one.
  const addedLists: string[] = []
  const reusedLists: string[] = []
  const renamedLists: { from: string, to: string }[] = []
  const listNameMap = new Map<string, string>()
  for (const [name, list] of Object.entries(lists)) {
    const existing = doc.choiceLists[name]
    if (existing === undefined) {
      doc.choiceLists[name] = list
      listNameMap.set(name, name)
      addedLists.push(name)
    } else if (deepEqualIgnoringKeyOrder(existing, list)) {
      listNameMap.set(name, name)
      reusedLists.push(name)
    } else {
      const finalName = uniqueNameIn(new Set(Object.keys(doc.choiceLists)), name)
      list.name = finalName
      doc.choiceLists[finalName] = list
      listNameMap.set(name, finalName)
      renamedLists.push({ from: name, to: finalName })
    }
  }
  visit(nodes, (node) => {
    if (node.kind === 'question' && node.listRef !== undefined) {
      node.listRef = listNameMap.get(node.listRef) ?? node.listRef
    }
    return undefined
  })

  const names = allNames(doc)
  for (const node of nodes) rehome(node, names)

  let strippedSaveTo = 0
  if (doc.entities === undefined) {
    // Keeping saveTo would instantly raise
    // entities.saveto-without-declaration on the target — strip rather than
    // paste a form straight into an error state.
    visit(nodes, (node) => {
      if (node.saveTo !== undefined) {
        delete node.saveTo
        strippedSaveTo++
      }
      return undefined
    })
  }

  const insertedIds: string[] = []
  nodes.forEach((node, i) => {
    insertNode(doc, node, target.parentId, target.index === undefined ? undefined : target.index + i)
    insertedIds.push(node.id)
  })

  return {
    insertedIds,
    addedLists,
    reusedLists,
    renamedLists,
    dormantLanguages,
    strippedSaveTo,
    attachmentFilenames: payload.attachmentFilenames,
  }
}
