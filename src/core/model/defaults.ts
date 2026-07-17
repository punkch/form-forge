/**
 * Shared predicates for a question's `defaultValue`: whether it names a
 * dynamic expression (pyxform: references a node or calls a function) and —
 * for image questions — the bare attachment filename it names. Single
 * source of truth reused by the serializer, parser, XLSForm reader/writer,
 * the rename/refs attachment traversal, and the future authoring UI, so
 * "the default image is X" means the same thing everywhere.
 */
import { hasText } from '../util/guards'
import type { FormNode } from './types'

/** pyxform: a default is dynamic when it references nodes or calls functions. */
export const isDynamicDefault = (value: string): boolean =>
  value.includes('${') || value.includes('(')

/** URI scheme prefix pyxform applies to a non-dynamic image-question default
 * in the primary instance (verified against pyxform 4.5.0), appearance-
 * independent. */
export const JR_IMAGES_PREFIX = 'jr://images/'

/** Idempotent removal of a leading JR_IMAGES_PREFIX — a value that doesn't
 * carry the prefix passes through unchanged. */
export const stripImagePrefix = (value: string): string =>
  value.startsWith(JR_IMAGES_PREFIX) ? value.slice(JR_IMAGES_PREFIX.length) : value

/**
 * The bare attachment filename an image question's `default` names, or
 * undefined when the node isn't an image question, has no default, or the
 * default is a dynamic expression (a calculation/reference, not a filename).
 * Strips a legacy `jr://images/`-prefixed value, so a previously imported
 * document behaves correctly without a migration.
 */
export const imageDefaultFilename = (node: FormNode): string | undefined => {
  if (node.kind !== 'question' || node.type !== 'image') return undefined
  const value = node.defaultValue
  if (!hasText(value) || isDynamicDefault(value)) return undefined
  return stripImagePrefix(value)
}
