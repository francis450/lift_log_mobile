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

const BAR_MAX = 24;

/** Bar heights in px for a fixed chart height: the scale tops out at 125% of target or the best day. */
export function barScale(values: (number | null)[], target: number, height: number) {
  const max = Math.max(target * 1.25, ...values.map((v) => v ?? 0));
  return {
    targetY: (target / max) * height,
    heights: values.map((v) => (v === null ? null : Math.max((v / max) * height, 4))),
  };
}

/**
 * Seven columns with a dashed target line. At or over target dark green, under target light green,
 * empty days a flat grey stub. Each logged day carries its value on the cap.
 */
export function ProteinBars({ days, target, height = 104 }: Props) {
  const { targetY, heights } = barScale(
    days.map((d) => d.protein),
    target,
    height,
  );
  return (
    <View
      accessible
      accessibilityLabel={`Protein this week, target ${target} grams. ${days
        .map((d) => `${d.label}: ${d.protein === null ? 'not logged' : `${d.protein} grams`}`)
        .join('. ')}`}
    >
      <View style={[styles.chart, { height: height + 18 }]}>
        <View style={[styles.targetLine, { bottom: targetY }]} />
        {days.map((d, i) => {
          const h = heights[i];
          const hit = d.protein !== null && d.protein >= target;
          return (
            <View key={i} style={styles.col}>
              {d.protein !== null ? <Text style={styles.value}>{d.protein}</Text> : null}
              <View
                style={[
                  styles.bar,
                  h === null
                    ? styles.stub
                    : { height: h, backgroundColor: hit ? colors.up : colors.upMid, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
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
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.ink3,
  },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  value: { fontFamily: fonts.mono, fontSize: 11, color: colors.ink2 },
  bar: { width: '100%', maxWidth: BAR_MAX },
  stub: { height: 4, borderRadius: 2, backgroundColor: colors.track },
  labels: { flexDirection: 'row', gap: 10, marginTop: 6 },
  label: { flex: 1, textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.66, color: colors.ink3 },
});
