import { StyleSheet, Text, View } from 'react-native';

import { formatKcal } from '@/lib/targets';
import { colors, fonts, type } from '@/theme';

interface Props {
  variant: 'calories' | 'protein';
  value: number;
  target: number | null;
  label?: string;
  /** Show the "X of Y left" caption. */
  caption?: boolean;
}

export function meterCaption(value: number, target: number, unit: string): string {
  const left = target - value;
  if (left < 0) return `${formatKcal(-left)} ${unit} over`;
  return `${formatKcal(left)} of ${formatKcal(target)} ${unit} left`;
}

/** Big number "/ target unit" over an 8 px track. Calories turn amber over target; protein stays green. */
export function Meter({ variant, value, target, label, caption }: Props) {
  const unit = variant === 'calories' ? 'kcal' : 'g';
  const over = !!target && value > target;
  const fill = variant === 'protein' ? colors.up : over ? colors.hold : colors.accent;
  const pct = target ? Math.min(value / target, 1) : 0;
  const suffix = variant === 'calories' ? 'kcal' : 'g protein';
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={`${label ?? (variant === 'calories' ? 'Calories' : 'Protein')}: ${formatKcal(value)}${
        target ? ` of ${formatKcal(target)}` : ''
      } ${unit}`}
    >
      {label ? <Text style={type.eyebrow}>{label}</Text> : null}
      <Text style={styles.big}>
        {formatKcal(value)}
        <Text style={styles.target}>{target ? ` / ${formatKcal(target)} ${suffix}` : ` ${suffix}`}</Text>
      </Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: fill }]} />
      </View>
      {caption && target ? (
        <Text style={[type.secondary, over && variant === 'calories' ? { color: colors.hold } : null]}>
          {meterCaption(value, target, unit)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, flex: 1 },
  big: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, color: colors.ink },
  target: { fontFamily: fonts.display, fontSize: 15, color: colors.ink3 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%' },
});
