/**
 * Content fingerprint of a form's serialized XForm, **excluding the version
 * attribute**, for per-destination publish freshness.
 *
 * A publish target remembers `lastPublishedContentHash` — the fingerprint of the
 * definition we last pushed to that destination. Comparing it to the current
 * form's fingerprint answers a purely local question: *"have I changed this form
 * since I last published it here?"* — driving the drawer's Up-to-date / Changed
 * chip with no network call.
 *
 * The version is neutralized (`settings.version` blanked) before serialization so
 * a version-only bump does not read as content drift — `settings.version` reaches
 * the XForm solely as the primary-instance root `version` attribute
 * (`serializer.ts`), and that attribute is omitted when the version is empty.
 *
 * Pure core — no Vue/Pinia/Dexie/vue-i18n imports; uses the same
 * `globalThis.crypto` surface as `vault.ts` / `ids.ts`.
 */
import type { FormDocument } from '@/core/model/types'
import { serializeXForm } from '@/core/xform/serializer'

/** Lowercase hex of the SHA-256 digest of `text`. */
const sha256Hex = async (text: string): Promise<string> => {
  const bytes = new TextEncoder().encode(text)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * SHA-256 (hex) of the form's serialized XForm with the version neutralized.
 * Two documents that differ only by `settings.version` share a fingerprint;
 * any other change (a label, a bind, an added question) changes it.
 */
export const contentFingerprint = async (doc: FormDocument): Promise<string> => {
  const neutralized: FormDocument = { ...doc, settings: { ...doc.settings, version: '' } }
  const { xml } = serializeXForm(neutralized)
  return sha256Hex(xml)
}
