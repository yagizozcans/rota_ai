import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CaptureScreen } from './screens/CaptureScreen';
import { PermissionGate } from './screens/PermissionGate';
import { usePermissions } from './permissions/usePermissions';

/**
 * Root component. Single-screen instrument panel — no router; the only
 * navigation is the permission gate → capture screen, handled as state.
 * Landscape is enforced natively (AndroidManifest sensorLandscape).
 */
function App() {
  const { status, request } = usePermissions();
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
