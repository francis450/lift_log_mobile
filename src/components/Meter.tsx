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
  /** Food day layout: the number alone, with the target in the caption ("1,480 of 2,200 left"). */
  stacked?: boolean;
}

export function meterCaption(value: number, target: number, unit: string): string {
  const left = target - value;
  if (left < 0) return `${formatKcal(-left)} ${unit} over`;
  return `${formatKcal(left)} of ${formatKcal(target)} ${unit} left`;
}

/** "1,480 of 2,200 left", "111 of 130 g left", "150 over" */
export function stackedCaption(value: number, target: number, variant: 'calories' | 'protein'): string {
  const unit = variant === 'protein' ? ' g' : '';
  const left = Math.round(target - value);
  if (left < 0) return `${formatKcal(-left)}${unit} over`;
  return `${formatKcal(left)} of ${formatKcal(target)}${unit} left`;
}

/** Big number "/ target unit" over an 8 px track. Calories turn amber over target; protein stays green. */
export function Meter({ variant, value, target, label, caption, stacked }: Props) {
  if (stacked) return <StackedMeter variant={variant} value={value} target={target} label={label} />;
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

function StackedMeter({ variant, value, target, label }: Omit<Props, 'caption' | 'stacked'>) {
  const over = !!target && value > target;
  const fill = variant === 'protein' ? colors.up : over ? colors.hold : colors.accent;
  const pct = target ? Math.min(value / target, 1) : 0;
  const name = label ?? (variant === 'calories' ? 'Calories' : 'Protein');
  const unit = variant === 'calories' ? 'kcal' : 'g';
  const big = `${formatKcal(value)}${variant === 'protein' ? ' g' : ''}`;
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={`${name}: ${formatKcal(value)}${target ? ` of ${formatKcal(target)}` : ''} ${unit}`}
    >
      <Text style={type.eyebrow}>{name}</Text>
      <Text style={[styles.big, styles.stackedBig]}>{big}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: fill }]} />
      </View>
      {target ? (
        <Text style={[type.secondary, over && variant === 'calories' ? { color: colors.hold } : null]}>
          {stackedCaption(value, target, variant)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stackedBig: { fontSize: 32, lineHeight: 34 },
  wrap: { gap: 6, flex: 1 },
  big: { fontFamily: fonts.display, fontSize: 30, lineHeight: 32, color: colors.ink },
  target: { fontFamily: fonts.display, fontSize: 15, color: colors.ink3 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: 'hidden' },
  fill: { height: '100%' },
});
