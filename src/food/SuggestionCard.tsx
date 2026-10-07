import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Meal, SuggestionOption } from '@/api/types';
import { formatKcal } from '@/lib/targets';
import { colors, fonts, radii, type } from '@/theme';

interface Props {
  meal: Meal;
  option: SuggestionOption | null;
  loading: boolean;
  onOther: () => void;
  onAdd: (option: SuggestionOption) => void;
}

export function SuggestionCard({ meal, option, loading, onOther, onAdd }: Props) {
  if (!option && !loading) return null;
  const kcal = option?.items.reduce((s, i) => s + i.kcal, 0) ?? 0;
  const protein = option?.items.reduce((s, i) => s + i.protein_g, 0) ?? 0;
  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      <View style={styles.head}>
        <Text style={[type.eyebrow, styles.eyebrow]}>Suggested {meal}</Text>
        {option ? (
          <Pressable accessibilityRole="button" onPress={onOther} disabled={loading} style={styles.other}>
            {loading ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.otherText}>Other ideas</Text>}
          </Pressable>
        ) : null}
      </View>
      {option ? (
        <>
          <Text style={styles.title}>{option.title}</Text>
          <Text style={type.secondary}>
            {formatKcal(kcal)} kcal · {Math.round(protein)} g protein.{option.why ? ` ${option.why}` : ''}
          </Text>
          <Pressable accessibilityRole="button" onPress={() => onAdd(option)} style={styles.add}>
            <Text style={styles.addText}>Add to {meal}</Text>
          </Pressable>
        </>
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={type.secondary}>Finding a {meal} idea…</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.accentSoft, borderRadius: radii.card, paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  eyebrow: { color: colors.accent },
  other: { minHeight: 44, minWidth: 44, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'flex-end' },
  otherText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.accent },
  title: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.ink },
  add: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.accent,
    justifyContent: 'center',
  },
  addText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.white },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
});
