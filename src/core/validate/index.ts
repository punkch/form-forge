import type { FormDocument } from '../model/types'
import { validateChoices } from './choices'
import { validateDatasets } from './datasets'
import { validateEntities } from './entities'
import { validateExpressions } from './expressions'
import type { Issue } from './issues'
import { validateNames } from './names'
import { validateParameters } from './parameters'
import { validateRefs } from './refs'
import { validateStructure } from './structure'
import { validateTranslations } from './translations'

export type { Issue, IssueScope, IssueSeverity } from './issues'
export { isSheetScope, scopeNodeId } from './issues'
export { NAME_RE } from './names'

/**
 * Optional environment facts validation can use when the caller has them.
 * validateDocument stays pure and synchronous — anything async (parsing
 * attachment blobs) happens upstream and is passed in here.
 */
export interface ValidateContext {
  /**
   * Parsed dataset header columns keyed by attachment filename;
   * null = attached but unparseable (skipped). Absent files are absent keys.
   */
  datasetColumns?: ReadonlyMap<string, readonly string[] | null>
}

/** Full model-level validation. Errors gate the preview; warnings don't. */
export const validateDocument = (doc: FormDocument, context: ValidateContext = {}): Issue[] => [
  ...validateNames(doc),
  ...validateRefs(doc),
  ...validateExpressions(doc),
  ...validateChoices(doc),
  ...validateStructure(doc),
  ...validateParameters(doc),
  ...validateTranslations(doc),
  ...validateEntities(doc),
  ...(context.datasetColumns === undefined ? [] : validateDatasets(doc, context.datasetColumns)),
]
