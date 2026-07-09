export type IssueSeverity = 'error' | 'warning' | 'info'

/** Where an issue lives: either a node/list/setting in the model, or a
 * sheet/row/column location reported by the XLSForm reader. */
export type IssueScope =
  | {
    nodeId?: string
    listName?: string
    choiceIndex?: number
    setting?: string
    language?: string
  }
  | {
    sheet: string
    /** 1-based Excel row number (header = row 1). */
    row: number
    column?: string
  }

export interface Issue {
  severity: IssueSeverity
  /** Stable machine code, e.g. 'name.duplicate', 'ref.unknown-list'. */
  code: string
  message: string
  scope: IssueScope
}

export const isSheetScope = (scope: IssueScope): scope is Extract<IssueScope, { sheet: string }> =>
  'sheet' in scope
