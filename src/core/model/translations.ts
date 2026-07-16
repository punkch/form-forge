/**
 * Pure helpers for form translations: the canonical language key, walking
 * every LocalizedText in a document, collecting translatable sites in
 * document order (for the translations grid), add/remove-language migrations
 * and the load-time default-content merge (normalizeDefaultContent). No Vue
 * imports — src/core stays pure TypeScript.
 */
import { hasText } from '../util/guards'
import { primaryLang, setText } from './display'
import { findNode, visit } from './ops'
import {
  DEFAULT_LANG,
  type FormDocument,
  type FormNode,
  type Lang,
  type LocalizedText,
  type MediaRefs,
} from './types'

/** 'French' + 'fr' → 'French (fr)' — byte-identical to the XLSForm column
 * suffix and the itext translation/@lang value. Code is optional. */
export const languageKey = (name: string, code?: string): Lang => {
  const trimmedName = name.trim()
  const trimmedCode = code?.trim() ?? ''
  return trimmedCode === '' ? trimmedName : `${trimmedName} (${trimmedCode})`
}

/** Inverse of languageKey's suffix: 'French (fr)' → 'fr'; a language declared
 * without a code returns undefined. */
export const languageCode = (lang: Lang): string | undefined =>
  /\(([^()]+)\)\s*$/.exec(lang)?.[1]

// primaryLang lives in display.ts (beside the text-resolution helpers it
// serves) but belongs to this module's public surface with the other
// language ops — re-exported so language logic keeps one import home.
export { primaryLang }

export const MEDIA_KINDS = ['image', 'audio', 'video', 'bigImage'] as const

/** The per-language media reference slots — the MediaRefs keys, i.e. the
 * XLSForm image/audio/video/big-image columns. */
export type MediaSlot = (typeof MEDIA_KINDS)[number]

/** Every non-empty per-language filename in one media slot's LocalizedText. */
export const mediaFilenames = (text: LocalizedText | undefined): string[] =>
  text === undefined ? [] : Object.values(text).filter((v): v is string => !!v && v.trim() !== '')

/**
 * Apply `fn` to every LocalizedText in the document (labels, hints, guidance,
 * bind messages, media refs, translated custom columns, choice labels/media).
 * Returning undefined from `fn` clears the property.
 */
export const transformLocalizedTexts = (
  doc: FormDocument,
  fn: (text: LocalizedText) => LocalizedText | undefined
): void => {
  const apply = <K extends string>(owner: Partial<Record<K, LocalizedText>>, key: K): void => {
    const text = owner[key]
    if (text !== undefined) owner[key] = fn(text)
  }
  const applyMedia = (media: MediaRefs | undefined): void => {
    if (media === undefined) return
    for (const kind of MEDIA_KINDS) apply(media, kind)
  }
  visit(doc.children, (node) => {
    apply(node, 'label')
    apply(node, 'hint')
    apply(node, 'guidanceHint')
    apply(node.bind, 'requiredMessage')
    apply(node.bind, 'constraintMessage')
    applyMedia(node.media)
    for (const [column, value] of Object.entries(node.customColumns ?? {})) {
      if (typeof value !== 'string' && node.customColumns !== undefined) {
        const next = fn(value)
        if (next === undefined) delete node.customColumns[column]
        else node.customColumns[column] = next
      }
    }
    return undefined
  })
  for (const list of Object.values(doc.choiceLists)) {
    for (const choice of list.choices) {
      apply(choice, 'label')
      applyMedia(choice.media)
    }
  }
}

export interface NormalizeResult {
  /** True when any text changed (moved, deduped, or debris cleared). */
  changed: boolean
  /** Cells where the sentinel and the target hold different non-empty text —
   * kept intact for the author to resolve. */
  conflicts: number
}

/**
 * Move every DEFAULT_LANG value into `target` (which must be a named
 * language, never the sentinel itself): empty-string sentinel debris is
 * deleted, a value moves when the target cell is empty and dedupes when both
 * are identical, and cells where both sides hold different non-empty text are
 * kept intact and counted as conflicts. Texts left with no keys are cleared.
 */
const mergeDefaultInto = (doc: FormDocument, target: Lang): NormalizeResult => {
  let changed = false
  let conflicts = 0
  transformLocalizedTexts(doc, (text) => {
    const value = text[DEFAULT_LANG]
    if (value === undefined) return text
    const existing = text[target]
    if (value !== '' && existing !== undefined && existing !== '' && existing !== value) {
      conflicts++ // keep both: the named value displays, the sentinel stays visible
    } else {
      if (value !== '') text[target] = value
      delete text[DEFAULT_LANG]
      changed = true
    }
    return Object.keys(text).length === 0 ? undefined : text
  })
  return { changed, conflicts }
}

/**
 * Merge stray DEFAULT_LANG content in an imported/legacy doc into the primary
 * language (Shape B docs carry no sentinel text — see the Lang docs in
 * types.ts). No-op for Shape A docs and for docs that literally declare a
 * "default" language. Never touches settings.defaultLanguage (that would
 * alter re-export of imports). Idempotent — safe at every load/import
 * boundary.
 */
export const normalizeDefaultContent = (doc: FormDocument): NormalizeResult =>
  doc.languages.length === 0 || doc.languages.includes(DEFAULT_LANG)
    ? { changed: false, conflicts: 0 }
    : mergeDefaultInto(doc, primaryLang(doc))

/**
 * Register a new language. The FIRST declared language becomes
 * settings.defaultLanguage and every DEFAULT_LANG value MOVES into it — the
 * doc flips from Shape A to Shape B with no sentinel content left behind.
 * Subsequent languages start empty.
 */
export const addLanguage = (doc: FormDocument, lang: Lang): boolean => {
  if (lang === '' || lang === DEFAULT_LANG || doc.languages.includes(lang)) return false
  const isFirst = doc.languages.length === 0
  doc.languages.push(lang)
  if (isFirst) {
    doc.settings.defaultLanguage = lang
    mergeDefaultInto(doc, lang)
  }
  return true
}

/**
 * Remove a language and strip its key from every LocalizedText. Removing the
 * LAST language returns the doc to Shape A: each removed value moves back to
 * the DEFAULT_LANG sentinel (add-then-remove restores the original shape),
 * except where a non-empty sentinel value already exists (an unresolved merge
 * conflict cell) — that keeps the sentinel text and drops the removed value.
 * settings.defaultLanguage is deleted on last removal and reassigned to the
 * first remaining language when the removed language was the default.
 */
export const removeLanguage = (doc: FormDocument, lang: Lang): boolean => {
  const index = doc.languages.indexOf(lang)
  if (index === -1) return false
  doc.languages.splice(index, 1)
  const isLast = doc.languages.length === 0
  transformLocalizedTexts(doc, (text) => {
    const value = text[lang]
    delete text[lang]
    const sentinel = text[DEFAULT_LANG]
    if (isLast && value !== undefined && value !== '' && (sentinel === undefined || sentinel === '')) {
      text[DEFAULT_LANG] = value
    }
    return Object.keys(text).length === 0 ? undefined : text
  })
  if (isLast) delete doc.settings.defaultLanguage
  else if (doc.settings.defaultLanguage === lang) doc.settings.defaultLanguage = doc.languages[0]
  return true
}

export type NodeTextField =
  | 'label' | 'hint' | 'guidanceHint' | 'requiredMessage' | 'constraintMessage'

export type TranslationSiteRef =
  | { kind: 'node', nodeId: string, field: NodeTextField }
  | { kind: 'node-media', nodeId: string, slot: MediaSlot }
  | { kind: 'choice', listName: string, choiceIndex: number }
  | { kind: 'choice-media', listName: string, choiceIndex: number, slot: MediaSlot }

export interface TranslationSite {
  ref: TranslationSiteRef
  /** Human context for the grid's first column, e.g. 'age · Label'. */
  context: string
  text: LocalizedText
}

const NODE_FIELD_TITLES: Record<NodeTextField, string> = {
  label: 'Label',
  hint: 'Hint',
  guidanceHint: 'Guidance hint',
  requiredMessage: 'Required message',
  constraintMessage: 'Constraint message',
}

/** English context strings for media rows, rendered verbatim in the grid
 * exactly like NODE_FIELD_TITLES (the Issue.message pattern — not i18n). */
const MEDIA_SLOT_TITLES: Record<MediaSlot, string> = {
  image: 'Image',
  audio: 'Audio',
  video: 'Video',
  bigImage: 'Big image',
}

/** Grid row order per node. Messages are relevance-gated (see
 * isFieldRelevant); guidanceHint is always emitted but flagged rarely-used. */
const SITE_FIELD_ORDER: readonly NodeTextField[] = [
  'label', 'hint', 'constraintMessage', 'requiredMessage', 'guidanceHint',
]

/** Fields the grid hides behind its "Show rarely-used fields" toggle. */
const RARELY_USED_FIELDS: readonly NodeTextField[] = ['guidanceHint']

export const isRarelyUsedSite = (ref: TranslationSiteRef): boolean =>
  ref.kind === 'node' && RARELY_USED_FIELDS.includes(ref.field)

const isBindField = (field: NodeTextField): field is 'requiredMessage' | 'constraintMessage' =>
  field === 'requiredMessage' || field === 'constraintMessage'

const readNodeText = (node: FormNode, field: NodeTextField): LocalizedText | undefined =>
  isBindField(field) ? node.bind[field] : node[field]

/** True when a LocalizedText carries a non-empty value in at least one
 * language. The shared "has text in ≥1 language" predicate — `v !== ''`
 * semantics (no trimming), matched by translationStats and the validators. */
export const hasAnyText = (text: LocalizedText | undefined): text is LocalizedText =>
  text !== undefined && Object.values(text).some((v) => v !== undefined && v !== '')

/** A node field is a translation site when it can carry text at all: label,
 * hint and guidance hint always; the messages only once their triggering
 * bind expression (constraint / required) is set. */
const isFieldRelevant = (node: FormNode, field: NodeTextField): boolean => {
  if (field === 'constraintMessage') return hasText(node.bind.constraint)
  if (field === 'requiredMessage') return hasText(node.bind.required)
  return true
}

/**
 * Every translatable site in document order: per-node label, hint, relevant
 * bind messages and guidance hint (all editable even when still empty), node
 * media refs that exist in at least one language, then each choice list's
 * labels (only once a label has a value) and existing choice media refs.
 */
export const collectTranslationSites = (doc: FormDocument): TranslationSite[] => {
  const sites: TranslationSite[] = []
  visit(doc.children, (node) => {
    for (const field of SITE_FIELD_ORDER) {
      if (!isFieldRelevant(node, field)) continue
      sites.push({
        ref: { kind: 'node', nodeId: node.id, field },
        context: `${node.name} · ${NODE_FIELD_TITLES[field]}`,
        text: readNodeText(node, field) ?? {},
      })
    }
    for (const slot of MEDIA_KINDS) {
      const text = node.media?.[slot]
      if (!hasAnyText(text)) continue
      sites.push({
        ref: { kind: 'node-media', nodeId: node.id, slot },
        context: `${node.name} · ${MEDIA_SLOT_TITLES[slot]}`,
        text,
      })
    }
    return undefined
  })
  for (const list of Object.values(doc.choiceLists)) {
    for (const [index, choice] of list.choices.entries()) {
      if (hasAnyText(choice.label)) {
        sites.push({
          ref: { kind: 'choice', listName: list.name, choiceIndex: index },
          context: `${list.name} / ${choice.name}`,
          text: choice.label,
        })
      }
      for (const slot of MEDIA_KINDS) {
        const text = choice.media?.[slot]
        if (!hasAnyText(text)) continue
        sites.push({
          ref: { kind: 'choice-media', listName: list.name, choiceIndex: index, slot },
          context: `${list.name} / ${choice.name} · ${MEDIA_SLOT_TITLES[slot]}`,
          text,
        })
      }
    }
  }
  return sites
}

/** Stable identity for a site, used for per-cell undo coalescing and grid
 * testids. The node:/choice: forms are frozen — only new kinds add forms. */
export const siteKey = (ref: TranslationSiteRef): string => {
  switch (ref.kind) {
    case 'node':
      return `node:${ref.nodeId}.${ref.field}`
    case 'node-media':
      return `node-media:${ref.nodeId}.${ref.slot}`
    case 'choice':
      return `choice:${ref.listName}[${ref.choiceIndex}]`
    case 'choice-media':
      return `choice-media:${ref.listName}[${ref.choiceIndex}].${ref.slot}`
  }
}

/** Write one media slot; an emptied slot is deleted and an emptied media
 * object removed entirely, so re-collection and removeLanguage's "strips
 * media refs" semantics never see `{}` debris. */
const setMediaText = (
  owner: { media?: MediaRefs },
  slot: MediaSlot,
  lang: Lang,
  value: string
): void => {
  const media = (owner.media ??= {})
  const next = setText(media[slot], value, lang)
  if (next === undefined) delete media[slot]
  else media[slot] = next
  if (Object.keys(media).length === 0) delete owner.media
}

/** Write one translation cell; empty values remove the key (via setText). */
export const setSiteText = (
  doc: FormDocument,
  ref: TranslationSiteRef,
  lang: Lang,
  value: string
): void => {
  if (ref.kind === 'node' || ref.kind === 'node-media') {
    const node = findNode(doc, ref.nodeId)
    if (node === null) return
    if (ref.kind === 'node-media') {
      setMediaText(node, ref.slot, lang, value)
      return
    }
    const next = setText(readNodeText(node, ref.field), value, lang)
    if (isBindField(ref.field)) node.bind[ref.field] = next
    else node[ref.field] = next
    return
  }
  const choice = doc.choiceLists[ref.listName]?.choices[ref.choiceIndex]
  if (choice === undefined) return
  if (ref.kind === 'choice-media') {
    setMediaText(choice, ref.slot, lang, value)
    return
  }
  choice.label = setText(choice.label, value, lang)
}

export interface TranslationStats {
  translated: number
  total: number
}

export const translationStats = (sites: TranslationSite[], lang: Lang): TranslationStats => {
  let translated = 0
  for (const site of sites) {
    const value = site.text[lang]
    if (value !== undefined && value !== '') translated++
  }
  return { translated, total: sites.length }
}

/**
 * Missing translation cells across every declared language (0 when the form
 * declares none). Only sites that already carry text in at least one language
 * count: the grid's always-editable empty rows (a hint or guidance hint with
 * no value) are an authoring affordance, not a missing translation.
 */
export const untranslatedCellCount = (doc: FormDocument): number => {
  if (doc.languages.length === 0) return 0
  const sites = collectTranslationSites(doc).filter((site) => hasAnyText(site.text))
  return doc.languages.reduce((missing, lang) => {
    const stats = translationStats(sites, lang)
    return missing + stats.total - stats.translated
  }, 0)
}
