import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Meal, SuggestionOption } from '@/api/types';
import { formatKcal } from '@/lib/targets';
import { colors, fonts, radii, type } from '@/theme';

import { MEALS, mealLabel } from './model';
import { leavesLine, MAX_OPTIONS, SuggestionState } from './suggestion';

interface Props {
  defaultMeal: Meal;
  state: SuggestionState | null;
  /** What's left of today's targets, for "Leaves … for later". */
  kcalLeft: number;
  proteinLeft: number;
  loading: boolean;
  error: string | null;
  onAsk: (meal: Meal) => void;
  onMore: () => void;
  onIndex: (index: number) => void;
  onClose: () => void;
  onAdd: (meal: Meal, option: SuggestionOption) => void;
}

type Page = { kind: 'option'; option: SuggestionOption } | { kind: 'more' };

/** "Need a meal idea?": nothing is asked of Claude until you pick a meal and tap Suggest. */
export function SuggestionCard(props: Props) {
  if (props.state) return <Options {...props} state={props.state} />;
  return <Ask {...props} />;
}

/** The options side by side: swipe to compare, the last page asks for more. */
function Options({ state, kcalLeft, proteinLeft, loading, error, onMore, onIndex, onClose, onAdd }: Props & { state: SuggestionState }) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(state.index);
  const [savedIndex, setSavedIndex] = useState(state.index);
  const list = useRef<FlatList<Page>>(null);
  // The saved index moved ("More ideas" landed, or a swipe was saved): follow it.
  if (savedIndex !== state.index) {
    setSavedIndex(state.index);
    setPage(state.index);
  }
  const label = mealLabel(state.meal).toLowerCase();
  const pages: Page[] = [
    ...state.options.map((option) => ({ kind: 'option' as const, option })),
    ...(state.options.length < MAX_OPTIONS ? [{ kind: 'more' as const }] : []),
  ];
  const onMorePage = page >= state.options.length;

  // "More ideas" moves the saved index to the first new option: scroll there.
  useEffect(() => {
    if (width) list.current?.scrollToIndex({ index: state.index, animated: true });
  }, [state.index, state.options.length, width]);

  function settle(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    setPage(i);
    if (i < state.options.length) onIndex(i);
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={[type.eyebrow, styles.eyebrow]}>Suggested {label}</Text>
        <View style={styles.headActions}>
          <Text style={styles.counter} accessibilityLiveRegion="polite">
            {onMorePage ? 'More ideas' : `${page + 1} of ${state.options.length}`}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close suggestion" onPress={onClose} style={styles.close}>
            <X size={18} strokeWidth={2} color={colors.accent} />
          </Pressable>
        </View>
      </View>
      {state.budget ? (
        <Text style={type.secondary}>
          Aim for about {formatKcal(state.budget.kcal)} kcal · {state.budget.protein_g} g protein at {label}.
        </Text>
      ) : null}

      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width ? (
          <FlatList
            ref={list}
            data={pages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(p, i) => (p.kind === 'option' ? `${i}:${p.option.title}` : 'more')}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            initialScrollIndex={Math.min(state.index, pages.length - 1)}
            onMomentumScrollEnd={settle}
            renderItem={({ item }) =>
              item.kind === 'option' ? (
                <View style={[styles.page, { width }]}>
                  <OptionPage
                    option={item.option}
                    leaves={leavesLine(item.option, kcalLeft, proteinLeft)}
                    label={label}
                    onAdd={() => onAdd(state.meal, item.option)}
                  />
                </View>
              ) : (
                <View style={[styles.page, { width }]}>
                  <Text style={styles.title}>Want something else?</Text>
                  <Text style={type.secondary}>Get more {label} ideas. The ones above stay here to compare.</Text>
                  <Pressable accessibilityRole="button" onPress={onMore} disabled={loading} style={[styles.add, styles.bottom]}>
                    {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.addText}>More ideas</Text>}
                  </Pressable>
                </View>
              )
            }
          />
        ) : null}
      </View>

      {pages.length > 1 ? (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {pages.map((p, i) => (
            <View key={i} style={[styles.dot, p.kind === 'more' && styles.dotMore, i === page && styles.dotOn]} />
          ))}
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function OptionPage({ option, leaves, label, onAdd }: { option: SuggestionOption; leaves: string; label: string; onAdd: () => void }) {
  const kcal = option.items.reduce((s, i) => s + i.kcal, 0);
  const protein = option.items.reduce((s, i) => s + i.protein_g, 0);
  return (
    <>
      <Text style={styles.title}>{option.title}</Text>
      <Text style={type.secondary}>
        {formatKcal(kcal)} kcal · {Math.round(protein)} g protein.{option.why ? ` ${option.why}` : ''}
      </Text>
      <Text style={styles.items}>{option.items.map((i) => `${i.food_name} (${i.portion})`).join(', ')}</Text>
      <Text style={styles.leaves}>{leaves}</Text>
      <Pressable accessibilityRole="button" onPress={onAdd} style={[styles.add, styles.bottom]}>
        <Text style={styles.addText}>Add to {label}</Text>
      </Pressable>
    </>
  );
}

function Ask({ defaultMeal, loading, error, onAsk }: Props) {
  const [meal, setMeal] = useState<Meal>(defaultMeal);
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
  headActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eyebrow: { color: colors.accent },
  counter: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.accent },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  page: { gap: 8, paddingRight: 2 },
  title: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.ink },
  items: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.ink2 },
  leaves: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
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
  // Keeps the add button in the same place on every page, whatever the text length.
  bottom: { marginTop: 'auto' },
  addText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.white },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.lineStrong },
  dotMore: { borderRadius: 1 },
  dotOn: { backgroundColor: colors.accent, width: 16 },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.ink2 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.danger },
});
