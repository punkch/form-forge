import { visit } from '../model/ops'
import { hasAnyText } from '../model/translations'
import { DEFAULT_LANG, type FormDocument, type LocalizedText } from '../model/types'
import type { Issue } from './issues'

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

  visit(doc.children, (node) => {
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
