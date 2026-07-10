import { visit } from '../model/ops'
import type { FormDocument, LocalizedText } from '../model/types'
import { effectiveItemsetFile, getQuestionType } from '../registry/question-types'
import type { Issue } from './issues'

const mediaFilenames = (text: LocalizedText | undefined): string[] =>
  text === undefined ? [] : Object.values(text).filter((v): v is string => !!v && v.trim() !== '')

export const validateRefs = (doc: FormDocument): Issue[] => {
  const issues: Issue[] = []
  const attachmentNames = new Set(doc.attachments.map((a) => a.filename))
  // Central serves the declared entity list as `<dataset>.csv` at runtime, so a
  // select reading that file needs no uploaded attachment. Ordinary from-file
  // selects (any other filename) still warn when their file is missing.
  const entityListFile = doc.entities !== undefined ? `${doc.entities.datasetName}.csv` : undefined

  visit(doc.children, (node) => {
    if (node.kind === 'question') {
      const def = getQuestionType(node.type)
      if (def === undefined) {
        issues.push({
          severity: 'warning',
          code: 'ref.unknown-type',
          message: `Question type "${node.type}" is not recognized; it will be preserved but cannot be edited fully.`,
          scope: { nodeId: node.id },
        })
      }
      if (def?.requiresChoices) {
        if (node.listRef === undefined || node.listRef === '') {
          issues.push({
            severity: 'error',
            code: 'ref.no-list',
            message: `${def.title} questions need a choice list.`,
            scope: { nodeId: node.id },
          })
        } else if (doc.choiceLists[node.listRef] === undefined) {
          issues.push({
            severity: 'error',
            code: 'ref.unknown-list',
            message: `Choice list "${node.listRef}" does not exist.`,
            scope: { nodeId: node.id },
          })
        }
      }
      const itemsetFile = effectiveItemsetFile(node)
      if (def?.requiresFile && itemsetFile === undefined) {
        issues.push({
          severity: 'error',
          code: 'ref.no-file',
          message: `${def.title} questions need an attached choices file.`,
          scope: { nodeId: node.id },
        })
      }
      if (
        itemsetFile !== undefined &&
        !attachmentNames.has(itemsetFile) &&
        itemsetFile !== entityListFile
      ) {
        issues.push({
          severity: 'warning',
          code: 'ref.missing-attachment',
          message: `Attachment "${itemsetFile}" is referenced but has not been uploaded.`,
          scope: { nodeId: node.id },
        })
      }
      if (node.saveTo !== undefined && node.saveTo !== '' && doc.entities === undefined) {
        issues.push({
          severity: 'error',
          code: 'entities.saveto-without-declaration',
          message: 'save_to is set but the form declares no entity list.',
          scope: { nodeId: node.id },
        })
      }
    }

    for (const media of [node.media?.image, node.media?.audio, node.media?.video, node.media?.bigImage]) {
      for (const filename of mediaFilenames(media)) {
        if (!attachmentNames.has(filename)) {
          issues.push({
            severity: 'warning',
            code: 'ref.missing-attachment',
            message: `Media file "${filename}" is referenced but has not been uploaded.`,
            scope: { nodeId: node.id },
          })
        }
      }
    }
    return undefined
  })

  // Choice-level media references.
  for (const list of Object.values(doc.choiceLists)) {
    for (const [i, choice] of list.choices.entries()) {
      for (const media of [choice.media?.image, choice.media?.audio, choice.media?.video, choice.media?.bigImage]) {
        for (const filename of mediaFilenames(media)) {
          if (!attachmentNames.has(filename)) {
            issues.push({
              severity: 'warning',
              code: 'ref.missing-attachment',
              message: `Media file "${filename}" (choice "${choice.name}") has not been uploaded.`,
              scope: { listName: list.name, choiceIndex: i },
            })
          }
        }
      }
    }
  }

  return issues
}
