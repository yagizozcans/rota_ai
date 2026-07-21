import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

/**
 * Large, glove-usable control button (≥64 dp touch target — 01 §3.7, UI
 * DIRECTION). Icon glyph over a short label, on a translucent-dark chip.
 */
export function BigButton({
  label,
  glyph,
  onPress,
  active = false,
  disabled = false,
}: {
  label: string;
  glyph: string;
  onPress?: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.button,
        active && styles.active,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={styles.inner}>
        <Text style={styles.glyph}>{glyph}</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 92,
    height: 72,
    borderRadius: 14,
    backgroundColor: theme.buttonBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: { backgroundColor: theme.buttonActiveBg },
  disabled: { backgroundColor: theme.buttonDisabled },
  pressed: { opacity: 0.7 },
  inner: { alignItems: 'center' },
  glyph: { fontSize: 22, marginBottom: 2 },
  label: { color: theme.textPrimary, fontSize: 12, fontWeight: '600' },
});
