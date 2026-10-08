import { X } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Meal, SuggestionOption } from '@/api/types';
import { formatKcal } from '@/lib/targets';
import { colors, fonts, radii, type } from '@/theme';

import { MEALS, mealLabel } from './model';

interface Props {
  defaultMeal: Meal;
  current: { meal: Meal; option: SuggestionOption } | null;
  loading: boolean;
  error: string | null;
  onAsk: (meal: Meal) => void;
  onOther: () => void;
  onClose: () => void;
  onAdd: (meal: Meal, option: SuggestionOption) => void;
}

/** "Need a meal idea?": nothing is asked of Claude until you pick a meal and tap Suggest. */
export function SuggestionCard({ defaultMeal, current, loading, error, onAsk, onOther, onClose, onAdd }: Props) {
  const [meal, setMeal] = useState<Meal>(defaultMeal);

  if (current) {
    const { option } = current;
    const label = mealLabel(current.meal).toLowerCase();
    const kcal = option.items.reduce((s, i) => s + i.kcal, 0);
    const protein = option.items.reduce((s, i) => s + i.protein_g, 0);
    return (
      <View style={styles.card} accessibilityLiveRegion="polite">
        <View style={styles.head}>
          <Text style={[type.eyebrow, styles.eyebrow]}>Suggested {label}</Text>
          <View style={styles.headActions}>
            <Pressable accessibilityRole="button" onPress={onOther} disabled={loading} style={styles.link}>
              {loading ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.linkText}>Other ideas</Text>}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Close suggestion" onPress={onClose} style={styles.close}>
              <X size={18} strokeWidth={2} color={colors.accent} />
            </Pressable>
          </View>
        </View>
        <Text style={styles.title}>{option.title}</Text>
        <Text style={type.secondary}>
          {formatKcal(kcal)} kcal · {Math.round(protein)} g protein.{option.why ? ` ${option.why}` : ''}
        </Text>
        <Text style={styles.items}>
          {option.items.map((i) => `${i.food_name} (${i.portion})`).join(', ')}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => onAdd(current.meal, option)} style={styles.add}>
          <Text style={styles.addText}>Add to {label}</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={[type.eyebrow, styles.eyebrow]}>Need a meal idea?</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Meal" style={styles.meals}>
        {MEALS.map((m) => {
          const on = m.key === meal;
          return (
            <Pressable
              key={m.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setMeal(m.key)}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable accessibilityRole="button" onPress={() => onAsk(meal)} disabled={loading} style={styles.add}>
        {loading ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.addText}>Suggest {mealLabel(meal).toLowerCase()}</Text>
        )}
      </Pressable>
      <Text style={styles.note}>Based on what you have eaten today and what is left of your targets.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.accentSoft, borderRadius: radii.card, paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  headActions: { flexDirection: 'row', alignItems: 'center' },
  eyebrow: { color: colors.accent },
  link: { minHeight: 44, minWidth: 44, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'flex-end' },
  linkText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.accent },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.ink },
  items: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.ink2 },
  meals: { flexDirection: 'row', gap: 6 },
  chip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink },
  chipTextOn: { color: colors.white },
  add: {
    alignSelf: 'flex-start',
    minHeight: 44,
    minWidth: 120,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.white },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.ink2 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.danger },
});
