import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

/**
 * Capture screen shell (Slice 1). The live camera, HUD overlay (§3.6) and the
 * right-side control stack (§3.7) are filled in by later slices — this is the
 * landscape-locked dark canvas they render into.
 */
export function CaptureScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>RotaAI — Çekim</Text>
      <Text style={styles.subtitle}>İskele hazır · yatay kilitli</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: theme.textPrimary,
    fontSize: 20,
    fontWeight: '600',
  },
  subtitle: {
    color: theme.textFaint,
    fontSize: 13,
    marginTop: 6,
  },
});
