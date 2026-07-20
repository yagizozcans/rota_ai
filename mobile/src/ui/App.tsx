import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CaptureScreen } from './screens/CaptureScreen';

/**
 * Root component. The app is a single-screen instrument panel — no router is
 * pulled in (the only navigation is the permission gate → capture, handled as
 * state in a later slice, not as routes). Landscape is enforced natively in
 * AndroidManifest (android:screenOrientation="sensorLandscape").
 */
function App() {
  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      <CaptureScreen />
    </SafeAreaProvider>
  );
}

export default App;
