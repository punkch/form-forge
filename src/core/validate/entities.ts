import type { FormDocument } from '../model/types'
import { NAME_RE } from './names'
import type { Issue } from './issues'

export const validateEntities = (doc: FormDocument): Issue[] => {
  const issues: Issue[] = []
  const entities = doc.entities
  if (entities === undefined) return issues

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

  if (entities.updateIf !== undefined && entities.updateIf !== '' && (entities.entityId === undefined || entities.entityId === '')) {
    issues.push({
      severity: 'error',
      code: 'entities.update-without-id',
      message: 'update_if requires entity_id so the form knows which entity to update.',
      scope: { setting: 'entities' },
    })
  }

  const creates = entities.createIf !== undefined && entities.createIf !== ''
  const updates = entities.entityId !== undefined && entities.entityId !== ''
  if (creates && (entities.label === undefined || entities.label === '')) {
    issues.push({
      severity: 'error',
      code: 'entities.create-without-label',
      message: 'Forms that create entities must set an entity label.',
      scope: { setting: 'entities' },
    })
  }
  if (!creates && !updates && (entities.label === undefined || entities.label === '')) {
    issues.push({
      severity: 'warning',
      code: 'entities.inert-declaration',
      message: 'The entity declaration neither creates nor updates entities.',
      scope: { setting: 'entities' },
    })
  }

  return issues
}
