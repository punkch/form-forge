import { CentralError } from '@/core/central/types'
import type { MessageKey } from '@/i18n'

/** Map a CentralError.kind to its `central.errors.*` copy; anything that is
 * not a CentralError falls back to the generic HTTP message. */
export const centralErrorKey = (error: unknown): MessageKey => {
  if (!(error instanceof CentralError)) return 'central.errors.http'
  switch (error.kind) {
    case 'cors': return 'central.errors.cors'
    case 'network': return 'central.errors.network'
    case 'auth': return 'central.errors.auth'
    case 'not-found': return 'central.errors.notFound'
    case 'conflict': return 'central.errors.conflict'
    default: return 'central.errors.http'
  }
}
