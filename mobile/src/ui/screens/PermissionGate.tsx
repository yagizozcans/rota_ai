import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import type { PermStatus } from '../permissions/usePermissions';

/**
 * Explicit UI for the permission states (ARCHITECTURE RULES: every permission
 * failure mode has a state). Shown until camera + location are both granted.
 */
export function PermissionGate({
  status,
  onRetry,
}: {
  status: PermStatus;
  onRetry: () => void;
}) {
  const checking = status === 'checking';
  return (
    <View style={styles.root}>
      <Text style={styles.title}>RotaAI — Çekim</Text>
      <Text style={styles.body}>
        {checking
          ? 'İzinler kontrol ediliyor…'
          : 'Çekim için kamera ve konum izni gerekli. Lütfen izin verin.'}
      </Text>
      {!checking && (
        <Pressable style={styles.button} onPress={onRetry} accessibilityRole="button">
          <Text style={styles.buttonText}>İzin ver</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: { color: theme.textPrimary, fontSize: 20, fontWeight: '600' },
  body: { color: theme.textFaint, fontSize: 14, textAlign: 'center', maxWidth: 420 },
  button: {
    marginTop: 8,
    backgroundColor: theme.buttonBg,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonText: { color: theme.textPrimary, fontSize: 15, fontWeight: '600' },
});
