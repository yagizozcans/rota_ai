import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { theme } from '../theme';

/**
 * Blinking red REC dot shown while recording (01 §3.7) — no timer, no counter,
 * just the dot (plan decision). Minimal, purposeful motion (UI DIRECTION).
 */
export function RecDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 600, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.dot, { opacity }]} />;
}

const styles = StyleSheet.create({
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.rec,
  },
});
