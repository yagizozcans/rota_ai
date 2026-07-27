import { StyleSheet, View } from 'react-native';
import { BigButton } from './BigButton';

/**
 * Right-side vertical stack of the three field controls (01 §3.7):
 *   Kayıt (Record) — starts/stops the distance-based auto capture; shown "active"
 *     while recording (the REC dot lives in the HUD).
 *   Foto — one manual frame, any time (recording or not; needs only a GPS fix).
 *   Öznitelik — placeholder for now (disabled), behaviour TBD (01 §3.7, Q?).
 */
export function ControlStack({
  recording,
  onToggleRecord,
  onPhoto,
}: {
  recording: boolean;
  onToggleRecord: () => void;
  onPhoto: () => void;
}) {
  return (
    <View style={styles.stack}>
      <BigButton
        label={recording ? 'Durdur' : 'Kayıt'}
        glyph={recording ? '■' : '●'}
        active={recording}
        onPress={onToggleRecord}
      />
      <BigButton label="Foto" glyph="◎" onPress={onPhoto} />
      <BigButton label="Öznitelik" glyph="＋" disabled />
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    gap: 14,
  },
});
