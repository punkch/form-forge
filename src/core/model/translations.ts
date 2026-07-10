/**
 * Pure helpers for form translations: the canonical language key, walking
 * every LocalizedText in a document, collecting translatable sites in
 * document order (for the translations grid), and add/remove-language
 * migrations. No Vue imports — src/core stays pure TypeScript.
 */
import { setText } from './display'
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

const MEDIA_KINDS = ['image', 'audio', 'video', 'bigImage'] as const

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

/**
 * Register a new language. When it is the FIRST declared language, every
 * existing DEFAULT_LANG value is copied into the new key (keeping 'default')
 * so no text disappears from itext-based output.
 */
export const addLanguage = (doc: FormDocument, lang: Lang): boolean => {
  if (lang === '' || lang === DEFAULT_LANG || doc.languages.includes(lang)) return false
  const isFirst = doc.languages.length === 0
  doc.languages.push(lang)
  if (isFirst) {
    transformLocalizedTexts(doc, (text) => {
      const fallback = text[DEFAULT_LANG]
      if (fallback !== undefined && fallback !== '' && text[lang] === undefined) {
        text[lang] = fallback
      }
      return text
    })
  }
  return true
}

/** Remove a language and strip its key from every LocalizedText. */
export const removeLanguage = (doc: FormDocument, lang: Lang): boolean => {
  const index = doc.languages.indexOf(lang)
  if (index === -1) return false
  doc.languages.splice(index, 1)
  transformLocalizedTexts(doc, (text) => {
    delete text[lang]
    return Object.keys(text).length === 0 ? undefined : text
  })
  if (doc.settings.defaultLanguage === lang) delete doc.settings.defaultLanguage
  return true
}

export type NodeTextField =
  | 'label' | 'hint' | 'guidanceHint' | 'requiredMessage' | 'constraintMessage'

export type TranslationSiteRef =
  | { kind: 'node', nodeId: string, field: NodeTextField }
  | { kind: 'choice', listName: string, choiceIndex: number }

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

const isBindField = (field: NodeTextField): field is 'requiredMessage' | 'constraintMessage' =>
  field === 'requiredMessage' || field === 'constraintMessage'

const readNodeText = (node: FormNode, field: NodeTextField): LocalizedText | undefined =>
  isBindField(field) ? node.bind[field] : node[field]

const hasAnyValue = (text: LocalizedText | undefined): text is LocalizedText =>
  text !== undefined && Object.values(text).some((v) => v !== undefined && v !== '')

/**
 * Every translatable string in document order: per-node label, hint,
 * guidance hint and bind messages, then each choice list's labels.
 * Sites with no value in any language are skipped — there is nothing
 * to translate yet.
 */
export const collectTranslationSites = (doc: FormDocument): TranslationSite[] => {
  const sites: TranslationSite[] = []
  visit(doc.children, (node) => {
    for (const field of Object.keys(NODE_FIELD_TITLES) as NodeTextField[]) {
      const text = readNodeText(node, field)
      if (hasAnyValue(text)) {
        sites.push({
          ref: { kind: 'node', nodeId: node.id, field },
          context: `${node.name} · ${NODE_FIELD_TITLES[field]}`,
          text,
        })
      }
    }
    return undefined
  })
  for (const list of Object.values(doc.choiceLists)) {
    for (const [index, choice] of list.choices.entries()) {
      if (hasAnyValue(choice.label)) {
        sites.push({
          ref: { kind: 'choice', listName: list.name, choiceIndex: index },
          context: `${list.name} / ${choice.name}`,
          text: choice.label,
        })
      }
    }
  }
  return sites
}

/** Stable identity for a site, used for per-cell undo coalescing. */
export const siteKey = (ref: TranslationSiteRef): string =>
  ref.kind === 'node'
    ? `node:${ref.nodeId}.${ref.field}`
    : `choice:${ref.listName}[${ref.choiceIndex}]`

/** Write one translation cell; empty values remove the key (via setText). */
export const setSiteText = (
  doc: FormDocument,
  ref: TranslationSiteRef,
  lang: Lang,
  value: string
): void => {
  if (ref.kind === 'node') {
    const node = findNode(doc, ref.nodeId)
    if (node === null) return
    const next = setText(readNodeText(node, ref.field), value, lang)
    if (isBindField(ref.field)) node.bind[ref.field] = next
    else node[ref.field] = next
    return
  }
  const choice = doc.choiceLists[ref.listName]?.choices[ref.choiceIndex]
  if (choice !== undefined) choice.label = setText(choice.label, value, lang)
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
