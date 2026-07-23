/**
 * Structural ops over a multi-node selection: block move, indent, outdent and
 * the cross-parent "gather" used by multi-drag. Each function operates on
 * `topMostNodes(doc, ids)` (a selected container implies its already-selected
 * descendants) and mutates `doc` in place, reusing `moveNode`'s forward-index
 * compensation and own-subtree guard. Callers run these inside one `mutate`
 * (store multi-move actions) or between `beginTransaction`/`endTransaction`
 * (drag gather) — never mid-`mutate`, so one gesture stays one undo entry.
 */
import { locateNode, moveNode, topMostNodes } from './ops'
import { isContainer, type FormDocument } from './types'

/**
 * Move the whole top-most selection by one slot within each node's own
 * sibling list (-1 up, +1 down) — the multi-select analogue of the store's
 * single-node `moveBy`. Aborts the WHOLE operation (returns false, doc
 * untouched) when any top-most node already sits at its list's edge in that
 * direction, checked up front before any mutation. Otherwise processes
 * top-first for -1 and bottom-first for +1 so a contiguous block moves as one
 * cohesive unit past its neighbor rather than folding into itself.
 */
export const moveNodesBy = (doc: FormDocument, ids: Iterable<string>, delta: -1 | 1): boolean => {
  const nodes = topMostNodes(doc, ids)
  if (nodes.length === 0) return false

  // Pre-flight: every top-most node must have room to move in its own list.
  for (const node of nodes) {
    const loc = locateNode(doc, node.id)
    if (loc === null) return false
    const siblings = loc.parent === null ? doc.children : loc.parent.children
    const target = loc.index + delta
    if (target < 0 || target >= siblings.length) return false
  }

  const ordered = delta < 0 ? nodes : [...nodes].reverse()
  for (const node of ordered) {
    const loc = locateNode(doc, node.id)
    if (loc === null) continue
    const siblings = loc.parent === null ? doc.children : loc.parent.children
    const target = loc.index + delta
    if (target < 0 || target >= siblings.length) continue // guarded by the pre-flight above
    // moveNode compensates for forward moves; pass the visual index (mirrors form.ts moveBy).
    moveNode(doc, node.id, loc.parent?.id ?? null, delta > 0 ? target + 1 : target)
  }
  return true
}

/**
 * Indent the whole top-most selection into the container preceding the
 * FIRST (document-order) top-most node — same rule as the store's
 * single-node `indent`. Subsequent top-most nodes are appended after it in
 * document order, so the block lands inside the container intact. Aborts
 * (returns false, doc untouched) when the first node has no preceding
 * sibling or that sibling isn't a container.
 */
export const indentNodes = (doc: FormDocument, ids: Iterable<string>): boolean => {
  const nodes = topMostNodes(doc, ids)
  if (nodes.length === 0) return false

  const firstLoc = locateNode(doc, nodes[0].id)
  if (firstLoc === null || firstLoc.index === 0) return false
  const siblings = firstLoc.parent === null ? doc.children : firstLoc.parent.children
  const previous = siblings[firstLoc.index - 1]
  if (!isContainer(previous)) return false

  for (const node of nodes) {
    const loc = locateNode(doc, node.id)
    if (loc === null) continue
    moveNode(doc, node.id, previous.id, previous.children.length)
  }
  return true
}

/**
 * Outdent every top-most node that has a parent, each landing right after
 * that parent (matching the store's single-node `outdent`). Processed in
 * reverse document order so nodes sharing a parent re-emerge after it in
 * their original relative order. Root-level top-most nodes are simply
 * skipped (no parent to outdent from) rather than blocking the others;
 * returns false (doc untouched) only when NONE of the selection could move.
 */
export const outdentNodes = (doc: FormDocument, ids: Iterable<string>): boolean => {
  const nodes = topMostNodes(doc, ids)
  if (nodes.length === 0) return false

  let moved = false
  for (const node of [...nodes].reverse()) {
    const loc = locateNode(doc, node.id)
    if (loc === null || loc.parent === null) continue
    const parentLoc = locateNode(doc, loc.parent.id)
    if (parentLoc === null) continue
    moveNode(doc, node.id, parentLoc.parent?.id ?? null, parentLoc.index + 1)
    moved = true
  }
  return moved
}

/**
 * The multi-drag gather primitive: relocate every top-most selected node
 * (other than `anchorId` itself) immediately after `anchorId`, inside the
 * anchor's own parent, preserving the selection's document order. Anchor
 * descendants are already excluded by `topMostNodes` (it doesn't recurse
 * into a hit); an attempt to gather an ancestor of the anchor — which would
 * require moving a container into its own subtree — is caught by
 * `moveNode`'s `containsNode` guard and silently skipped rather than
 * aborting the rest. Returns false when there's nothing to gather (unknown
 * anchor, or the selection is the anchor alone).
 */
export const gatherNodesAfter = (doc: FormDocument, ids: Iterable<string>, anchorId: string): boolean => {
  const initialLoc = locateNode(doc, anchorId)
  if (initialLoc === null) return false
  const nodes = topMostNodes(doc, ids).filter((n) => n.id !== anchorId)
  if (nodes.length === 0) return false

  const parentId = initialLoc.parent?.id ?? null
  // `placed` advances only on a successful placement, so a guard-blocked
  // move (see above) doesn't shift where the next node lands. The anchor is
  // re-located on every iteration rather than cached: when a to-be-gathered
  // node currently sits BEFORE the anchor in the same list, removing it
  // shifts the anchor's own index, and moveNode's target must be computed
  // against its up-to-date position, not a stale one.
  let placed = 0
  for (const node of nodes) {
    const anchorLoc = locateNode(doc, anchorId)
    if (anchorLoc === null) continue // the anchor itself never moves in this loop
    if (moveNode(doc, node.id, parentId, anchorLoc.index + 1 + placed)) placed++
  }
  return true
}
