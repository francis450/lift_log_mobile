import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatKcal } from '@/lib/targets';
import { colors, fonts, type } from '@/theme';

export interface MealEntryView {
  key: string;
  name: string;
  /** e.g. "1.5 x 1 medium" */
  quantity: string;
  kcal: number;
  protein: number;
}

interface Props {
  title: string;
  entries: MealEntryView[];
  onLongPressEntry?: (key: string) => void;
}

/** Meal title and total, entry rows (name, qty, kcal mono grey, protein mono green), or "Nothing yet". */
export function MealSection({ title, entries, onLongPressEntry }: Props) {
  const kcal = entries.reduce((sum, e) => sum + e.kcal, 0);
  const protein = entries.reduce((sum, e) => sum + e.protein, 0);
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {entries.length ? (
          <Text style={styles.total}>
            {formatKcal(kcal)} kcal · {Math.round(protein)} g
          </Text>
        ) : null}
      </View>
      {entries.length === 0 ? <Text style={type.secondary}>Nothing yet</Text> : null}
      {entries.map((e) => (
        <Pressable
          key={e.key}
          onLongPress={onLongPressEntry ? () => onLongPressEntry(e.key) : undefined}
          accessibilityHint={onLongPressEntry ? 'Long press to edit or delete' : undefined}
          accessibilityLabel={`${e.name}, ${e.quantity}, ${formatKcal(e.kcal)} kcal, ${Math.round(e.protein)} grams protein`}
          style={styles.row}
        >
          <View style={styles.name}>
            <Text style={type.bodyMedium} numberOfLines={1}>
              {e.name}
            </Text>
            <Text style={type.secondary}>{e.quantity}</Text>
          </View>
          <Text style={styles.kcal}>{formatKcal(e.kcal)}</Text>
          <Text style={styles.protein}>{Math.round(e.protein)} g</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  total: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    borderTopWidth: 1,
    borderTopColor: colors.track,
    paddingTop: 8,
  },
  name: { flex: 1 },
  kcal: { fontFamily: fonts.mono, fontSize: 14, color: colors.ink2 },
  protein: { fontFamily: fonts.mono, fontSize: 14, color: colors.up, minWidth: 44, textAlign: 'right' },
});
