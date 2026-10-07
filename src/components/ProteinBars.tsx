import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

export interface ProteinDay {
  label: string;
  protein: number | null;
}

interface Props {
  days: ProteinDay[];
  target: number;
  height?: number;
}

/** Seven bars with a dashed target line. At/over target dark green, under light green, empty days a grey stub. */
export function ProteinBars({ days, target, height = 120 }: Props) {
  const max = Math.max(target * 1.2, ...days.map((d) => d.protein ?? 0));
  const targetY = (target / max) * height;
  return (
    <View
      accessible
      accessibilityLabel={`Protein this week, target ${target} g: ${days
        .map((d) => `${d.label} ${d.protein === null ? 'not logged' : `${d.protein} g`}`)
        .join(', ')}`}
    >
      <View style={[styles.chart, { height: height + 18 }]}>
        <View style={[styles.targetLine, { bottom: targetY }]} />
        {days.map((d, i) => {
          const empty = d.protein === null;
          const barHeight = empty ? 4 : Math.max((d.protein! / max) * height, 4);
          const hit = !empty && d.protein! >= target;
          return (
            <View key={i} style={styles.col}>
              {!empty ? <Text style={styles.value}>{d.protein}</Text> : null}
              <View
                style={[
                  styles.bar,
                  { height: barHeight, backgroundColor: empty ? colors.track : hit ? colors.up : colors.upSoft },
                  !empty && !hit ? styles.under : null,
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {days.map((d, i) => (
          <Text key={i} style={styles.label}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.ink3,
  },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 2 },
  value: { fontFamily: fonts.mono, fontSize: 11, color: colors.ink2 },
  bar: { width: '100%', borderRadius: 6 },
  under: { borderWidth: 1, borderColor: colors.up },
  labels: { flexDirection: 'row', gap: 8, marginTop: 6 },
  label: { flex: 1, textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 11, color: colors.ink3 },
});
