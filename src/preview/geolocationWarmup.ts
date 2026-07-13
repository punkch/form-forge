/**
 * Pre-request the browser's geolocation permission when a previewed form
 * contains geo questions. web-forms attempts its first fix as soon as the
 * widget needs one and renders "Location unavailable … restart the form" if
 * the permission prompt isn't answered in time — asking while the form loads
 * means the grant is already in place by the time the user reaches the
 * question. Asked at most once per page session so the debounced preview
 * regeneration can't re-prompt someone who dismissed the dialog.
 */
const GEO_QUESTION = /geopoint|geotrace|geoshape/

let requested = false

export const warmUpGeolocation = async (formXml: string): Promise<void> => {
  if (requested || !GEO_QUESTION.test(formXml)) return
  const geolocation = globalThis.navigator?.geolocation
  if (geolocation === undefined) return
  requested = true
  try {
    const status = await globalThis.navigator.permissions?.query({ name: 'geolocation' })
    if (status !== undefined && status.state !== 'prompt') return
  } catch {
    // Permissions API unavailable (older Safari) — request unconditionally.
  }
  geolocation.getCurrentPosition(() => {}, () => {}, { timeout: 60_000 })
}
