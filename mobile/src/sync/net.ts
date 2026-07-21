import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { config } from '../config';

/**
 * Connectivity watch for the sync engine. Holds the latest network state and
 * answers whether uploading is allowed — honouring the optional Wi-Fi-only gate
 * for pilots on metered SIMs (plan Q10). Native; the engine consumes the pure
 * isSyncAllowed() via an injected callback.
 */

let latest = { connected: true, type: 'unknown' as string };

export function startNetWatch(onChange?: (allowed: boolean) => void): () => void {
  return NetInfo.addEventListener((state: NetInfoState) => {
    latest = { connected: state.isConnected ?? false, type: state.type };
    onChange?.(isSyncAllowed());
  });
}

export function isSyncAllowed(): boolean {
  if (!latest.connected) {
    return false;
  }
  if (config.SYNC_WIFI_ONLY && latest.type !== 'wifi') {
    return false;
  }
  return true;
}
