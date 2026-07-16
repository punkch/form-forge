import { visit } from '../model/ops'
import { hasAnyText, MEDIA_KINDS } from '../model/translations'
import {
  DEFAULT_LANG,
  type FormDocument,
  type FormNode,
  type LocalizedText,
  type MediaRefs,
} from '../model/types'
import { warning, type Issue } from './issues'

const missingLangs = (text: LocalizedText | undefined, languages: string[]): string[] => {
  // Only flag partially-translated strings: something is set, but not for
  // every declared language (a value under DEFAULT_LANG counts as a
  // fallback for the default language only).
  if (!hasAnyText(text)) return []
  return languages.filter((lang) => {
    const value = text[lang]
    return value === undefined || value === ''
  })
}

/** A non-empty value under the DEFAULT_LANG sentinel key — text not assigned
 * to any named language (hasAnyText's `v !== ''` semantics, no trimming). */
const hasUnassignedValue = (text: LocalizedText | undefined): boolean => {
  const value = text?.[DEFAULT_LANG]
  return value !== undefined && value !== ''
}

const mediaHasUnassignedValue = (media: MediaRefs | undefined): boolean =>
  media !== undefined && MEDIA_KINDS.some((slot) => hasUnassignedValue(media[slot]))

/** Every LocalizedText a node carries: label, hint, guidance hint, bind
 * messages, media slots and translated custom columns. */
const nodeHasUnassignedText = (node: FormNode): boolean =>
  hasUnassignedValue(node.label) ||
  hasUnassignedValue(node.hint) ||
  hasUnassignedValue(node.guidanceHint) ||
  hasUnassignedValue(node.bind.requiredMessage) ||
  hasUnassignedValue(node.bind.constraintMessage) ||
  mediaHasUnassignedValue(node.media) ||
  Object.values(node.customColumns ?? {})
    .some((value) => typeof value !== 'string' && hasUnassignedValue(value))

export const validateTranslations = (doc: FormDocument): Issue[] => {
  const issues: Issue[] = []
  if (doc.languages.length === 0) return issues

  if (
    doc.settings.defaultLanguage !== undefined &&
    doc.settings.defaultLanguage !== DEFAULT_LANG &&
    !doc.languages.includes(doc.settings.defaultLanguage)
  ) {
    issues.push({
      severity: 'warning',
      code: 'i18n.unknown-default-language',
      message: `default_language "${doc.settings.defaultLanguage}" is not one of the form's languages.`,
      scope: { setting: 'defaultLanguage' },
    })
  }

  // When 'default' IS a declared language (parser edge case: an XForm with
  // <translation lang="default">), the sentinel key is a named language and
  // nothing is unassigned.
  const flagUnassigned = !doc.languages.includes(DEFAULT_LANG)

  visit(doc.children, (node) => {
    if (flagUnassigned && nodeHasUnassignedText(node)) {
      issues.push(warning(
        'i18n.unassigned-text',
        `"${node.name}" has text not assigned to any language.`,
        { nodeId: node.id }
      ))
    }
    for (const lang of missingLangs(node.label, doc.languages)) {
      issues.push({
        severity: 'warning',
        code: 'i18n.missing-translation',
        message: `Label is missing its ${lang} translation.`,
        scope: { nodeId: node.id, language: lang },
      })
    }
    for (const lang of missingLangs(node.hint, doc.languages)) {
      issues.push({
        severity: 'warning',
        code: 'i18n.missing-translation',
        message: `Hint is missing its ${lang} translation.`,
        scope: { nodeId: node.id, language: lang },
      })
    }
    return undefined
  })

  for (const list of Object.values(doc.choiceLists)) {
    if (flagUnassigned && list.choices.some(
      (choice) => hasUnassignedValue(choice.label) || mediaHasUnassignedValue(choice.media)
    )) {
      issues.push(warning(
        'i18n.unassigned-text',
        `Choice list "${list.name}" has text not assigned to any language.`,
        { listName: list.name }
      ))
    }
    for (const [i, choice] of list.choices.entries()) {
      for (const lang of missingLangs(choice.label, doc.languages)) {
        issues.push({
          severity: 'warning',
          code: 'i18n.missing-translation',
          message: `Choice "${choice.name}" in list "${list.name}" is missing its ${lang} label.`,
          scope: { listName: list.name, choiceIndex: i, language: lang },
        })
      }
    }
  }

  return issues
}
