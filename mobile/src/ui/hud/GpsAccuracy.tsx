import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';
import { gpsAccuracyLevel, type GpsLevel } from './hudCompute';

const LEVEL_COLOR: Record<GpsLevel, string> = {
  good: theme.gpsGood,
  warn: theme.gpsWarn,
  bad: theme.gpsBad,
};

/**
 * GPS accuracy readout, colour-coded green/amber/red at the 10 m / 20 m
 * thresholds (01 §3.6). `null` accuracy (no fix yet) shows a neutral dash.
 */
export function GpsAccuracy({ accuracyM }: { accuracyM: number | null }) {
  const color = accuracyM == null ? theme.textFaint : LEVEL_COLOR[gpsAccuracyLevel(accuracyM)];
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>
        {accuracyM == null ? 'GPS —' : `GPS ${Math.round(accuracyM)}m`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  text: { fontSize: 15, fontWeight: '600' },
});
