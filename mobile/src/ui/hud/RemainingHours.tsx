import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import { formatRemaining, isStorageLow } from './hudCompute';

/**
 * Remaining recording time from free storage (01 §3.6). Turns red under the
 * warn threshold so the operator knows before the device fills up.
 */
export function RemainingHours({ minutes }: { minutes: number }) {
  const low = isStorageLow(minutes);
  return (
    <View style={styles.chip}>
      <Text style={[styles.text, low && styles.low]}>{formatRemaining(minutes)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { alignItems: 'flex-start' },
  text: { color: theme.textPrimary, fontSize: 15, fontWeight: '600' },
  low: { color: theme.warn },
});
