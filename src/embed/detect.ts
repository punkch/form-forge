/**
 * Embed-mode activation. The app runs embedded when '?embed=1' appears in the
 * real query string — BEFORE the hash, since routing is hash-based — AND the
 * page is actually inside another window's frame. The optional 'origin'
 * parameter pins the host origin: inbound messages from any other origin are
 * silently ignored and outbound messages target it instead of '*'.
 */
export interface EmbedDetection {
  active: boolean
  /** Pinned host origin, or null when no (usable) origin param was given. */
  origin: string | null
}

export const detectEmbed = (
  search: string = window.location.search,
  framed: boolean = window.parent !== window
): EmbedDetection => {
  const params = new URLSearchParams(search)
  const active = params.get('embed') === '1' && framed
  const origin = params.get('origin')
  return {
    active,
    origin: active && origin !== null && origin !== '' ? origin : null,
  }
}

let memo: EmbedDetection | null = null

/**
 * Detection against the real window, computed once. main.ts and the router
 * both need it at boot; memoizing keeps the '?embed=1' query parsed exactly
 * once and guarantees they agree.
 */
export const embedDetection = (): EmbedDetection => (memo ??= detectEmbed())
