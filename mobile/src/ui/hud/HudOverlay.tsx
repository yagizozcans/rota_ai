import { StyleSheet, Text, View } from 'react-native';
import { config } from '../../config';
import { useCaptureStore } from '../state/captureStore';
import { useSyncStore } from '../state/syncStore';
import { theme } from '../theme';
import { estimateRemainingMinutes } from './hudCompute';
import { GpsAccuracy } from './GpsAccuracy';
import { RemainingHours } from './RemainingHours';
import { TempIndicator } from './TempIndicator';
import { FilePathTag } from './FilePathTag';
import { RecDot } from './RecDot';
import { useTemperature } from './useTemperature';

/**
 * The information layer drawn over the live camera (01 §3.6). Reads live state
 * from the store; positioned for landscape — status chips top-left, REC top-
 * right, file path bottom-left. Non-interactive (pointerEvents none) so it never
 * eats touches meant for the camera or the control stack.
 */
export function HudOverlay({ framePath }: { framePath: string }) {
  const recording = useCaptureStore((s) => s.recording);
  const fix = useCaptureStore((s) => s.fix);
  const freeBytes = useCaptureStore((s) => s.freeBytes);
  const framesPerMinute = useCaptureStore((s) => s.framesPerMinute());
  const capturedCount = useCaptureStore((s) => s.capturedCount);
  const uploadedCount = useSyncStore((s) => s.uploadedCount);

  // Seeded average frame size until per-frame measurement lands (Slice 5+).
  const avgFrameBytes = config.AVG_FRAME_SIZE_SEED_KB * 1024;
  const remainingMinutes = estimateRemainingMinutes(
    freeBytes ?? 0,
    avgFrameBytes,
    framesPerMinute,
  );
  const { tempC, stale } = useTemperature(fix?.lat ?? null, fix?.lon ?? null);

  return (
    <View style={styles.root} pointerEvents="none">
      <View style={[styles.chip, styles.topLeft]}>
        <RemainingHours minutes={remainingMinutes} />
        <TempIndicator tempC={tempC} stale={stale} />
        <GpsAccuracy accuracyM={fix?.accuracy_m ?? null} />
      </View>

      {recording && (
        <View style={[styles.chip, styles.topRight]}>
          <RecDot />
        </View>
      )}

      <View style={[styles.chip, styles.bottomRight]}>
        <Text style={styles.counts}>
          {capturedCount} çekildi · {uploadedCount} yüklendi
        </Text>
      </View>

      <View style={[styles.chip, styles.bottomLeft]}>
        <FilePathTag path={framePath} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  chip: {
    position: 'absolute',
    backgroundColor: theme.scrim,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  topLeft: { top: 12, left: 12, gap: 6 },
  topRight: { top: 12, right: 12 },
  bottomLeft: { bottom: 12, left: 12, maxWidth: '55%' },
  bottomRight: { bottom: 12, right: 12 },
  counts: { color: theme.textPrimary, fontSize: 13, fontWeight: '600' },
});
