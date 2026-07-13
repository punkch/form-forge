import { translate } from '@/i18n'
import type { useCentralStore } from '@/stores/central'

type CentralStore = ReturnType<typeof useCentralStore>

/**
 * The connection status label for a server, shared by the Central pickers and
 * the servers section so the copy stays identical. A connected server reads
 * "Connected as {email}" (email falling back to '' when the session carries
 * none); otherwise the label is "Connecting…" while a connect attempt is in
 * flight (`connecting`), and "Not connected" at rest.
 */
export const connectionLabel = (
  central: CentralStore,
  serverId: string,
  connecting = false
): string => {
  if (central.isConnected(serverId)) {
    return translate('central.connection.connectedAs', { email: central.connectionState(serverId).email ?? '' })
  }
  return translate(connecting ? 'central.connection.connecting' : 'central.connection.notConnected')
}
