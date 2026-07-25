import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSyncStore } from '../state/syncStore';
import { theme } from '../theme';

/**
 * Slim indicator for the frame currently uploading, shown above the file-path
 * tag (01 §3.6 area). RN's fetch() exposes no upload-progress events, so this is
 * an INDETERMINATE animated bar (not a real %) that appears while a frame is in
 * flight and clears when done. Non-interactive (the HUD sets pointerEvents="none").
 */
const TRACK_WIDTH = 160;
const BAR_WIDTH = 44;

export function UploadProgress() {
  const current = useSyncStore((s) => s.currentUpload);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!current) {
      return;
    }
    x.setValue(0);
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 900, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [current, x]);

  if (!current) {
    return null;
  }

  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [-BAR_WIDTH, TRACK_WIDTH],
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.label} numberOfLines={1}>
        Yükleniyor: {current.frameId.slice(0, 8)}….jpg
      </Text>
      <View style={styles.track}>
        <Animated.View style={[styles.bar, { transform: [{ translateX }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 6 },
  label: {
    color: theme.textFaint,
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 3,
  },
  track: {
    height: 3,
    width: TRACK_WIDTH,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    overflow: 'hidden',
  },
  bar: {
    height: 3,
    width: BAR_WIDTH,
    borderRadius: 2,
    backgroundColor: theme.gpsGood,
  },
});
