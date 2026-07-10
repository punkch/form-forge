import { defineStore } from 'pinia'
import { computed, ref, shallowRef, toRaw } from 'vue'

import { createNode } from '@/core/model/factory'
import {
  cloneSubtree,
  findNode,
  flatten,
  insertNode,
  locateNode,
  moveNode,
  removeNode,
} from '@/core/model/ops'
import { isContainer, type FormDocument, type FormNode } from '@/core/model/types'
import { validateDocument, type Issue } from '@/core/validate'
import { translate } from '@/i18n'
import * as formsRepo from '@/persistence/forms-repo'

export type SaveState = 'saved' | 'saving' | 'dirty' | 'error'

const AUTOSAVE_DEBOUNCE_MS = 1500
const VALIDATE_DEBOUNCE_MS = 300
const UNDO_COALESCE_MS = 500
const UNDO_LIMIT = 100

interface UndoEntry {
  label: string
  doc: FormDocument
  at: number
}

/** The currently open form: document, mutations, undo/redo, autosave, issues. */
export const useFormStore = defineStore('form', () => {
  const recordId = ref<string | null>(null)
  const doc = ref<FormDocument | null>(null)
  const saveState = ref<SaveState>('saved')
  const issues = shallowRef<Issue[]>([])

  const undoStack = shallowRef<UndoEntry[]>([])
  const redoStack = shallowRef<UndoEntry[]>([])

  let autosaveTimer: ReturnType<typeof setTimeout> | null = null
  let validateTimer: ReturnType<typeof setTimeout> | null = null

  const canUndo = computed(() => undoStack.value.length > 0)
  const canRedo = computed(() => redoStack.value.length > 0)
  const undoLabel = computed(() => undoStack.value.at(-1)?.label ?? null)
  const errorCount = computed(() => issues.value.filter((i) => i.severity === 'error').length)

  const issuesByNode = computed(() => {
    const map = new Map<string, Issue[]>()
    for (const issue of issues.value) {
      if ('nodeId' in issue.scope && issue.scope.nodeId !== undefined) {
        const list = map.get(issue.scope.nodeId)
        if (list === undefined) map.set(issue.scope.nodeId, [issue])
        else list.push(issue)
      }
    }
    return map
  })

  const snapshotDoc = (): FormDocument => structuredClone(toRaw(doc.value)) as FormDocument

  const runValidation = (): void => {
    if (doc.value === null) return
    issues.value = validateDocument(doc.value as FormDocument)
  }

  const scheduleValidation = (): void => {
    if (validateTimer !== null) clearTimeout(validateTimer)
    validateTimer = setTimeout(runValidation, VALIDATE_DEBOUNCE_MS)
  }

  const flushSave = async (): Promise<void> => {
    if (recordId.value === null || doc.value === null) return
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer)
      autosaveTimer = null
    }
    saveState.value = 'saving'
    try {
      await formsRepo.saveForm(recordId.value, snapshotDoc())
      saveState.value = 'saved'
    } catch (error) {
      console.error('Autosave failed', error)
      saveState.value = 'error'
    }
  }

  const scheduleSave = (): void => {
    saveState.value = 'dirty'
    if (autosaveTimer !== null) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => { void flushSave() }, AUTOSAVE_DEBOUNCE_MS)
  }

  const load = async (id: string): Promise<boolean> => {
    const record = await formsRepo.getForm(id)
    if (record === undefined) return false
    recordId.value = id
    doc.value = structuredClone(record.doc)
    undoStack.value = []
    redoStack.value = []
    saveState.value = 'saved'
    // Validate before the awaited snapshot write: the preview store's
    // watchers flush during that await and must see this form's issues,
    // not the previous form's.
    runValidation()
    await formsRepo.addSnapshot(id, record.doc, 'open')
    return true
  }

  const close = async (): Promise<void> => {
    await flushSave()
    recordId.value = null
    doc.value = null
    undoStack.value = []
    redoStack.value = []
    issues.value = []
  }

  /**
   * Single mutation gateway: snapshots for undo, applies the mutation,
   * schedules autosave + validation. Coalescing (rapid same-label edits
   * collapse into one undo entry) is opt-in — right for typing bursts,
   * wrong for structural moves.
   */
  const mutate = (label: string, fn: (doc: FormDocument) => void, opts: { coalesce?: boolean } = {}): void => {
    if (doc.value === null) return
    const now = Date.now()
    const last = undoStack.value.at(-1)
    const coalesce = opts.coalesce === true &&
      last !== undefined && last.label === label && now - last.at < UNDO_COALESCE_MS
    if (!coalesce) {
      undoStack.value = [
        ...undoStack.value.slice(-(UNDO_LIMIT - 1)),
        { label, doc: snapshotDoc(), at: now },
      ]
    } else if (last !== undefined) {
      last.at = now
    }
    redoStack.value = []
    fn(doc.value as FormDocument)
    scheduleSave()
    scheduleValidation()
  }

  const undo = (): void => {
    const entry = undoStack.value.at(-1)
    if (entry === undefined || doc.value === null) return
    undoStack.value = undoStack.value.slice(0, -1)
    redoStack.value = [...redoStack.value, { label: entry.label, doc: snapshotDoc(), at: Date.now() }]
    doc.value = entry.doc
    scheduleSave()
    scheduleValidation()
  }

  const redo = (): void => {
    const entry = redoStack.value.at(-1)
    if (entry === undefined || doc.value === null) return
    redoStack.value = redoStack.value.slice(0, -1)
    undoStack.value = [...undoStack.value, { label: entry.label, doc: snapshotDoc(), at: Date.now() }]
    doc.value = entry.doc
    scheduleSave()
    scheduleValidation()
  }

  /**
   * Drag-and-drop support: vue-draggable-plus mutates the reactive children
   * arrays in place, so a drag can't go through mutate(). beginTransaction()
   * snapshots for undo before the drag; endTransaction() marks
   * dirty/validates after it.
   */
  const beginTransaction = (label: string): void => {
    if (doc.value === null) return
    undoStack.value = [
      ...undoStack.value.slice(-(UNDO_LIMIT - 1)),
      { label, doc: snapshotDoc(), at: Date.now() },
    ]
    redoStack.value = []
  }

  const endTransaction = (): void => {
    // Cancelled drags leave the doc untouched — drop the useless undo entry.
    const last = undoStack.value.at(-1)
    if (last !== undefined && doc.value !== null &&
      JSON.stringify(last.doc) === JSON.stringify(toRaw(doc.value))) {
      undoStack.value = undoStack.value.slice(0, -1)
      return
    }
    scheduleSave()
    scheduleValidation()
  }

  // --- Domain actions (all undoable) -------------------------------------

  const addNode = (type: string, parentId: string | null, index?: number): string | null => {
    let newNodeId: string | null = null
    mutate(translate('stores.form.undoAddQuestion'), (d) => {
      const node = createNode(d, type)
      if (insertNode(d, node, parentId, index)) newNodeId = node.id
    })
    return newNodeId
  }

  const removeNodeById = (id: string): void => {
    mutate(translate('stores.form.undoDeleteQuestion'), (d) => { removeNode(d, id) })
  }

  const duplicateNodeById = (id: string): string | null => {
    let newNodeId: string | null = null
    mutate(translate('stores.form.undoDuplicateQuestion'), (d) => {
      const loc = locateNode(d, id)
      if (loc === null) return
      const clone = cloneSubtree(d, loc.node)
      insertNode(d, clone, loc.parent?.id ?? null, loc.index + 1)
      newNodeId = clone.id
    })
    return newNodeId
  }

  const moveNodeTo = (id: string, parentId: string | null, index: number): void => {
    mutate(translate('stores.form.undoMoveQuestion'), (d) => { moveNode(d, id, parentId, index) })
  }

  /** Move within the current sibling list by delta (-1 up, +1 down). */
  const moveBy = (id: string, delta: number): void => {
    mutate(translate('stores.form.undoMoveQuestion'), (d) => {
      const loc = locateNode(d, id)
      if (loc === null) return
      const siblings = loc.parent === null ? d.children : loc.parent.children
      const target = loc.index + delta
      if (target < 0 || target >= siblings.length) return
      // moveNode compensates for forward moves; pass the visual index.
      moveNode(d, id, loc.parent?.id ?? null, delta > 0 ? target + 1 : target)
    })
  }

  /** Move into the previous sibling when it is a group/repeat (append). */
  const indent = (id: string): void => {
    mutate(translate('stores.form.undoMoveQuestion'), (d) => {
      const loc = locateNode(d, id)
      if (loc === null || loc.index === 0) return
      const siblings = loc.parent === null ? d.children : loc.parent.children
      const previous = siblings[loc.index - 1]
      if (!isContainer(previous)) return
      moveNode(d, id, previous.id, previous.children.length)
    })
  }

  /** Move out of the parent container, placed right after it. */
  const outdent = (id: string): void => {
    mutate(translate('stores.form.undoMoveQuestion'), (d) => {
      const loc = locateNode(d, id)
      if (loc === null || loc.parent === null) return
      const parentLoc = locateNode(d, loc.parent.id)
      if (parentLoc === null) return
      moveNode(d, id, parentLoc.parent?.id ?? null, parentLoc.index + 1)
    })
  }

  /** Generic field edit; `label` drives undo coalescing per property. */
  const updateNode = (id: string, label: string, fn: (node: FormNode, doc: FormDocument) => void): void => {
    mutate(label, (d) => {
      const node = findNode(d, id)
      if (node !== null) fn(node, d)
    }, { coalesce: true })
  }

  const getNode = (id: string | null): FormNode | null =>
    id === null || doc.value === null ? null : findNode(doc.value as FormDocument, id)

  /** All field names, for ${} autocomplete. */
  const fieldNames = computed<string[]>(() => {
    if (doc.value === null) return []
    return flatten((doc.value as FormDocument).children).map((n) => n.name)
  })

  return {
    recordId,
    doc,
    saveState,
    issues,
    issuesByNode,
    errorCount,
    canUndo,
    canRedo,
    undoLabel,
    fieldNames,
    load,
    close,
    mutate,
    undo,
    redo,
    flushSave,
    beginTransaction,
    endTransaction,
    addNode,
    removeNodeById,
    duplicateNodeById,
    moveNodeTo,
    moveBy,
    indent,
    outdent,
    updateNode,
    getNode,
  }
})
