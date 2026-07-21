import { StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

/**
 * Small, faded monospace path in the bottom-left showing where this session's
 * frames are written on device (01 §3.6) — answers "where is my data" and helps
 * field debugging at a glance.
 */
export function FilePathTag({ path }: { path: string }) {
  return (
    <Text style={styles.text} numberOfLines={1} ellipsizeMode="middle">
      {path}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: theme.textFaint,
    fontSize: 11,
    fontFamily: 'monospace',
  },
});
