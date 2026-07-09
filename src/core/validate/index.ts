import type { FormDocument } from '../model/types'
import { validateChoices } from './choices'
import { validateEntities } from './entities'
import { validateExpressions } from './expressions'
import type { Issue } from './issues'
import { validateNames } from './names'
import { validateRefs } from './refs'
import { validateTranslations } from './translations'

export type { Issue, IssueScope, IssueSeverity } from './issues'
export { isSheetScope } from './issues'
export { NAME_RE } from './names'

/** Full model-level validation. Errors gate the preview; warnings don't. */
export const validateDocument = (doc: FormDocument): Issue[] => [
  ...validateNames(doc),
  ...validateRefs(doc),
  ...validateExpressions(doc),
  ...validateChoices(doc),
  ...validateTranslations(doc),
  ...validateEntities(doc),
]
