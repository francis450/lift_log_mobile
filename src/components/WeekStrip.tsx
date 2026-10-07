import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDayShort, weekdayLabel } from '@/lib/dates';
import { colors, fonts } from '@/theme';

export interface StripDay {
  date: string;
  trained: boolean;
  fed: boolean;
}

interface Props {
  days: StripDay[];
  selected: string;
  onSelect?: (date: string) => void;
}

function Dot({ on, color }: { on: boolean; color: string }) {
  return <View style={[styles.dot, on ? { backgroundColor: color } : styles.dotEmpty]} />;
}

/** Seven day cells; two dots each (training green, food accent; hollow grey when empty). */
export function WeekStrip({ days, selected, onSelect }: Props) {
  return (
    <View style={styles.row}>
      {days.map((day) => {
        const { dow, num } = weekdayLabel(day.date);
        const isSelected = day.date === selected;
        const label = `${formatDayShort(day.date)}: ${day.trained ? 'trained' : 'no training logged'}, ${
          day.fed ? 'food logged' : 'no food logged'
        }`;
        return (
          <Pressable
            key={day.date}
            disabled={!onSelect}
            onPress={() => onSelect?.(day.date)}
            accessibilityLabel={label}
            accessibilityState={{ selected: isSelected }}
            style={[styles.cell, isSelected && styles.selected]}
          >
            <Text style={styles.dow}>{dow}</Text>
            <Text style={styles.num}>{num}</Text>
            <View style={styles.dots}>
              <Dot on={day.trained} color={colors.up} />
              <Dot on={day.fed} color={colors.accent} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, paddingHorizontal: 20 },
  cell: {
    flex: 1,
    minHeight: 64,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 2,
  },
  selected: { borderColor: colors.accent, borderWidth: 2, paddingVertical: 7 },
  dow: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.66, color: colors.ink3 },
  num: { fontFamily: fonts.displaySemi, fontSize: 18, lineHeight: 20, color: colors.ink },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  dotEmpty: { borderWidth: 1.5, borderColor: colors.lineStrong },
});
