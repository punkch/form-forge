import { flatten } from '../model/ops'
import type { FormDocument } from '../model/types'
import { NAME_RE } from './names'
import type { Issue } from './issues'

export const validateChoices = (doc: FormDocument): Issue[] => {
  const issues: Issue[] = []
  const allowDuplicates = doc.settings.allowChoiceDuplicates === true

  const usedLists = new Set(
    flatten(doc.children)
      .filter((n) => n.kind === 'question')
      .map((n) => (n.kind === 'question' ? n.listRef : undefined))
      .filter((ref): ref is string => ref !== undefined)
  )

  for (const list of Object.values(doc.choiceLists)) {
    const seen = new Map<string, number>()
    for (const [i, choice] of list.choices.entries()) {
      if (choice.name.trim() === '') {
        issues.push({
          severity: 'error',
          code: 'choice.empty-name',
          message: `Choice ${i + 1} in list "${list.name}" has no name.`,
          scope: { listName: list.name, choiceIndex: i },
        })
        continue
      }
      if (!NAME_RE.test(choice.name) && !/^[^\s]+$/.test(choice.name)) {
        issues.push({
          severity: 'warning',
          code: 'choice.name-whitespace',
          message: `Choice name "${choice.name}" in list "${list.name}" contains whitespace.`,
          scope: { listName: list.name, choiceIndex: i },
        })
      }
      const firstIndex = seen.get(choice.name)
      if (firstIndex !== undefined && !allowDuplicates) {
        issues.push({
          severity: 'error',
          code: 'choice.duplicate',
          message: `Choice name "${choice.name}" appears more than once in list "${list.name}" (set allow_choice_duplicates to permit this).`,
          scope: { listName: list.name, choiceIndex: i },
        })
      }
      if (firstIndex === undefined) seen.set(choice.name, i)
    }

    if (list.choices.length === 0 && usedLists.has(list.name)) {
      issues.push({
        severity: 'warning',
        code: 'choice.empty-list',
        message: `Choice list "${list.name}" is used by a question but has no choices.`,
        scope: { listName: list.name },
      })
    }
    if (!usedLists.has(list.name)) {
      issues.push({
        severity: 'info',
        code: 'choice.unused-list',
        message: `Choice list "${list.name}" is not used by any question.`,
        scope: { listName: list.name },
      })
    }
  }

  return issues
}
