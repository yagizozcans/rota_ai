import { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { startSync } from '../sync/syncEngine';
import { CaptureScreen } from './screens/CaptureScreen';
import { PermissionGate } from './screens/PermissionGate';
import { usePermissions } from './permissions/usePermissions';
import { useSyncStore } from './state/syncStore';

/**
 * Root component. Single-screen instrument panel — no router; the only
 * navigation is the permission gate → capture screen, handled as state.
 * Landscape is enforced natively (AndroidManifest sensorLandscape).
 *
 * The sync engine starts here (not in the capture screen) so uploads drain
 * whenever the app is alive — independent of recording, even with the camera
 * closed (IMPLEMENTATION-PLAN §3).
 */
function App() {
  const { status, request } = usePermissions();
  const incUploaded = useSyncStore((s) => s.incUploaded);
  const startUpload = useSyncStore((s) => s.startUpload);
  const endUpload = useSyncStore((s) => s.endUpload);

  useEffect(
    () => startSync({ onUploaded: incUploaded, onUploadStart: startUpload, onUploadEnd: endUpload }),
    [incUploaded, startUpload, endUpload],
  );

  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      {status === 'granted' ? (
        <CaptureScreen />
      ) : (
        <PermissionGate status={status} onRetry={request} />
      )}
    </SafeAreaProvider>
  );
}

export default App;
