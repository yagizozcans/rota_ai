import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { HudOverlay } from '../hud/HudOverlay';
import { ControlStack } from '../controls/ControlStack';
import { useCaptureEngine } from '../capture/useCaptureEngine';
import { useCaptureStore } from '../state/captureStore';
import { DEV_IDENTITY } from '../state/session';
import { frameStoreDir } from '../../storage/files';
import { theme } from '../theme';

/**
 * Landscape capture screen: full-bleed live camera with the HUD overlay (§3.6)
 * and the right-side control stack (§3.7) on top. Record toggles the auto
 * distance-capture; Foto takes a manual frame.
 */
export function CaptureScreen() {
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);
  const recording = useCaptureStore((s) => s.recording);
  const { start, stop, captureManual } = useCaptureEngine(cameraRef, DEV_IDENTITY);

  const onToggleRecord = () => {
    if (recording) {
      stop();
    } else {
      start();
    }
  };

  if (!device) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>Kamera bulunamadı</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Camera ref={cameraRef} style={StyleSheet.absoluteFill} device={device} isActive photo />
      <HudOverlay framePath={frameStoreDir()} />
      <ControlStack recording={recording} onToggleRecord={onToggleRecord} onPhoto={captureManual} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  fallback: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: { color: theme.textPrimary, fontSize: 16 },
});
