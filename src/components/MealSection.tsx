import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatKcal } from '@/lib/targets';
import { colors, fonts } from '@/theme';

export interface MealEntryView {
  key: string;
  name: string;
  /** e.g. "× 1.5" */
  quantity: string;
  kcal: number;
  protein: number;
}

interface Props {
  title: string;
  entries: MealEntryView[];
  onLongPressEntry?: (key: string) => void;
  divider?: boolean;
}

/** Meal title and total, entry rows (name × qty, kcal mono grey, protein mono green), or "Nothing yet". */
export function MealSection({ title, entries, onLongPressEntry, divider }: Props) {
  const kcal = entries.reduce((sum, e) => sum + e.kcal, 0);
  const protein = entries.reduce((sum, e) => sum + e.protein, 0);
  return (
    <View style={[styles.section, divider && styles.divider]}>
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
      {entries.length === 0 ? <Text style={styles.empty}>Nothing yet</Text> : null}
      {entries.map((e) => (
        <Pressable
          key={e.key}
          onLongPress={onLongPressEntry ? () => onLongPressEntry(e.key) : undefined}
          accessibilityRole={onLongPressEntry ? 'button' : undefined}
          accessibilityHint={onLongPressEntry ? 'Long press to change the amount or delete' : undefined}
          accessibilityLabel={`${e.name} ${e.quantity.replace('×', 'times')}, ${formatKcal(e.kcal)} kcal, ${Math.round(e.protein)} grams protein`}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Text style={styles.name} numberOfLines={2}>
            {e.name} <Text style={styles.qty}>{e.quantity}</Text>
          </Text>
          <Text style={styles.kcal}>{formatKcal(e.kcal)}</Text>
          <Text style={styles.protein}>{Math.round(e.protein)} g</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, paddingVertical: 10, gap: 2 },
  divider: { borderTopWidth: 1, borderTopColor: colors.track },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 36 },
  title: { fontFamily: fonts.displaySemi, fontSize: 20, color: colors.ink },
  total: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink3 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.ink3, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  pressed: { opacity: 0.6 },
  name: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  qty: { color: colors.ink3 },
  kcal: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink3 },
  protein: { fontFamily: fonts.mono, fontSize: 13, color: colors.up, minWidth: 40, textAlign: 'right' },
});
