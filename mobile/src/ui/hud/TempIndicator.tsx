import { StyleSheet, Text } from 'react-native';
import { theme } from '../theme';
import { formatTemp } from './hudCompute';

/**
 * Ambient temperature (01 §3.6, plan Q10). Best-effort and HUD-only — shows "~"
 * when there is no source, and fades when the cached value is stale.
 */
export function TempIndicator({ tempC, stale }: { tempC: number | null; stale: boolean }) {
  return (
    <Text style={[styles.text, (tempC == null || stale) && styles.faint]}>{formatTemp(tempC)}</Text>
  );
}

const styles = StyleSheet.create({
  text: { color: theme.textPrimary, fontSize: 15, fontWeight: '600' },
  faint: { color: theme.textFaint },
});
