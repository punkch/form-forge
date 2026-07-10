/**
 * Small structural type guards shared across the core and the embed protocol.
 * Pure — no Vue/Pinia/DOM imports — so the protocol layer can reuse them.
 */

/** A plain object: not null, not an array. The narrow used before indexing an
 * untrusted `unknown` value as a record. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
