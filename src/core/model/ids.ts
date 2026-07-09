/** Stable unique ids for nodes/documents. Wrapped so tests can stub it. */
export const newId = (): string => globalThis.crypto.randomUUID()
