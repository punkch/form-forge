import { findRefs } from '../expr/tokenizer'
import { flatten } from '../model/ops'
import type { FormDocument, QuestionNode } from '../model/types'
import { effectiveItemsetFile } from '../registry/question-types'
import { hasText } from '../util/guards'
import { NAME_RE } from './names'
import type { Issue } from './issues'

/** pyxform 4.5.0 rejects these save_to targets case-insensitively. */
const RESERVED_SAVE_TO = new Set(['name', 'label'])

export const validateEntities = (doc: FormDocument): Issue[] => {
  const issues: Issue[] = []
  const questions = flatten(doc.children)
    .filter((n): n is QuestionNode => n.kind === 'question')

  // --- save_to property mappings (pyxform-parity, all errors) --------------
  const saveToByProperty = new Map<string, QuestionNode>()
  for (const node of questions) {
    if (!hasText(node.saveTo)) continue
    const property = node.saveTo.trim()
    if (RESERVED_SAVE_TO.has(property.toLowerCase())) {
      issues.push({
        severity: 'error',
        code: 'entities.reserved-save-to',
        message: 'save_to must not be "name" or "label" (any casing) — those entity properties are set by the entity system itself.',
        scope: { nodeId: node.id },
      })
      continue
    }
    if (!NAME_RE.test(property)) {
      issues.push({
        severity: 'error',
        code: 'entities.invalid-save-to',
        message: `"${property}" is not a valid entity property name. Start with a letter or underscore; then letters, digits, "_", "-" or ".".`,
        scope: { nodeId: node.id },
      })
      continue
    }
    const first = saveToByProperty.get(property)
    if (first !== undefined) {
      issues.push({
        severity: 'error',
        code: 'entities.duplicate-save-to',
        message: `The entity property "${property}" is already saved by "${first.name}". Each property can only be saved by one question.`,
        scope: { nodeId: node.id },
      })
    } else {
      saveToByProperty.set(property, node)
    }
  }

  const entities = doc.entities
  if (entities === undefined) return issues

  // --- declaration ----------------------------------------------------------
  if (entities.datasetName.trim() === '') {
    issues.push({
      severity: 'error',
      code: 'entities.no-dataset',
      message: 'The entity declaration needs a list name (dataset).',
      scope: { setting: 'entities' },
    })
  } else if (!NAME_RE.test(entities.datasetName)) {
    issues.push({
      severity: 'error',
      code: 'entities.invalid-dataset',
      message: `"${entities.datasetName}" is not a valid entity list name.`,
      scope: { setting: 'entities' },
    })
  }

  if (hasText(entities.updateIf) && !hasText(entities.entityId)) {
    issues.push({
      severity: 'error',
      code: 'entities.update-without-id',
      message: 'update_if requires entity_id so the form knows which entity to update.',
      scope: { setting: 'entities' },
    })
  }

  const creates = hasText(entities.createIf)
  const updates = hasText(entities.entityId)
  if (creates && !hasText(entities.label)) {
    issues.push({
      severity: 'error',
      code: 'entities.create-without-label',
      message: 'Forms that create entities must set an entity label.',
      scope: { setting: 'entities' },
    })
  }
  if (!creates && !updates && !hasText(entities.label)) {
    issues.push({
      severity: 'warning',
      code: 'entities.inert-declaration',
      message: 'The entity declaration neither creates nor updates entities.',
      scope: { setting: 'entities' },
    })
  }

  // --- follow-up (update) consistency ----------------------------------------
  if (updates) {
    const datasetFile = `${entities.datasetName}.csv`
    const consumers = questions.filter((n) => effectiveItemsetFile(n) === datasetFile)
    if (consumers.length === 0) {
      issues.push({
        severity: 'warning',
        code: 'entities.follow-up-no-source',
        message: `The form updates "${entities.datasetName}" entities but no question selects from ${datasetFile}, so the entity id and version lookups have nothing to resolve against.`,
        scope: { setting: 'entities' },
      })
    }

    // entity_id referencing a *_from_file question that reads a different
    // file than the declared dataset is almost certainly a mistake.
    const idRef = findRefs(entities.entityId ?? '')[0]
    if (idRef !== undefined) {
      const source = questions.find((n) => n.name === idRef.name)
      const sourceFile = source === undefined ? undefined : effectiveItemsetFile(source)
      if (sourceFile !== undefined && sourceFile !== datasetFile) {
        issues.push({
          severity: 'warning',
          code: 'entities.dataset-file-mismatch',
          message: `entity_id comes from "${source?.name}", which selects from ${sourceFile}, but the declaration updates the "${entities.datasetName}" list (expected ${datasetFile}).`,
          scope: { nodeId: source?.id },
        })
      }
    }
  }

  return issues
}
