import { useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { EstimateItem, FoodEntry, FoodSource, Meal } from '@/api/types';
import { useSuggestion } from '@/food/suggestion';
import { SuggestionCard } from '@/food/SuggestionCard';
import { Card } from '@/components/Card';
import { ExtendedFab } from '@/components/ExtendedFab';
import { MealSection } from '@/components/MealSection';
import { Meter } from '@/components/Meter';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Snackbar } from '@/components/Snackbar';
import { useProfile, useTimeZone } from '@/hooks/queries';
import { addDays, formatDayShort, minutesNowIn, todayIn } from '@/lib/dates';
import { colors, type } from '@/theme';
import { AddFoodSheet, AddRequest } from '@/food/AddFoodSheet';
import { saveCustomFood, updateFoodDay, useFoodDay, useFoodLibrary } from '@/food/data';
import { EditEntrySheet } from '@/food/EditEntrySheet';
import {
  entryKcal,
  entryProtein,
  formatQty,
  isDoubleAdd,
  LastAdd,
  makeEntry,
  mealForTime,
  mealLabel,
  MEALS,
  totals,
  withEntry,
  withoutEntry,
  withQty,
} from '@/food/model';

interface Notice {
  message: string;
  undo?: () => void;
}

export default function FoodScreen() {
  const tz = useTimeZone();
  const params = useLocalSearchParams<{ date?: string }>();
  // Opening Food for a date (from History) starts a fresh screen on that day.
  return <FoodDayScreen key={params.date ?? 'today'} initialDate={params.date ?? todayIn(tz)} />;
}

function FoodDayScreen({ initialDate }: { initialDate: string }) {
  const tz = useTimeZone();
  const today = todayIn(tz);
  const [date, setDate] = useState(initialDate);
  const { day, refetch, loading } = useFoodDay(date);
  const profile = useProfile().data;
  const foods = useFoodLibrary(today);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FoodEntry | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const lastAdd = useRef<LastAdd | null>(null);

  const sum = totals(day.entries);
  const kcalTarget = profile?.kcal_target ?? 2200;
  const proteinTarget = profile?.protein_target_g ?? null;
  const ai = profile?.ai ?? { ready: false, message: null };
  const nowMeal = mealForTime(minutesNowIn(tz));
  // Suggestions only run when asked for, to keep Claude calls down.
  const suggestion = useSuggestion(date);

  function addMany(meal: Meal, items: EstimateItem[], source: FoodSource) {
    if (!items.length) return;
    const now = new Date();
    const entries = items.map((item) => makeEntry({ meal, item, qty: 1, source, now }));
    void updateFoodDay(date, (d) => entries.reduce(withEntry, d));
    setAdding(false);
    const ids = new Set(entries.map((e) => e.client_id));
    setNotice({
      message:
        entries.length === 1
          ? `Added ${entries[0].food_name} to ${mealLabel(meal)}`
          : `Added ${entries.length} foods to ${mealLabel(meal)}`,
      undo: () => void updateFoodDay(date, (d) => ({ ...d, entries: d.entries.filter((e) => !ids.has(e.client_id)) })),
    });
  }

  function add(request: AddRequest) {
    const entry = makeEntry({ meal: request.meal, item: request.item, qty: request.qty, source: request.source, now: new Date() });
    const commit = () => {
      lastAdd.current = { food_name: entry.food_name, portion: entry.portion, qty: entry.qty, meal: entry.meal, at: Date.now() };
      void updateFoodDay(date, (d) => withEntry(d, entry));
      if (request.saveToMyFoods) void saveCustomFood(request.item);
      setAdding(false);
      setNotice({
        message: `Added ${entry.food_name} to ${mealLabel(entry.meal)}`,
        undo: () => void updateFoodDay(date, (d) => withoutEntry(d, entry.client_id)),
      });
    };
    if (isDoubleAdd(lastAdd.current, entry, Date.now())) {
      Alert.alert('Add it again?', `You just added ${entry.food_name} to ${mealLabel(entry.meal)}.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add again', onPress: commit },
      ]);
      return;
    }
    commit();
  }

  function remove(entry: FoodEntry) {
    setEditing(null);
    void updateFoodDay(date, (d) => withoutEntry(d, entry.client_id));
    setNotice({
      message: `Removed ${entry.food_name}`,
      undo: () => void updateFoodDay(date, (d) => withEntry(d, entry)),
    });
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        eyebrow={formatDayShort(date)}
        title="Food"
        right={
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous day"
              onPress={() => setDate(addDays(date, -1))}
              style={styles.dayButton}
            >
              <ChevronLeft size={22} strokeWidth={2} color={colors.ink} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next day"
              disabled={date >= today}
              onPress={() => setDate(addDays(date, 1))}
              style={[styles.dayButton, date >= today && styles.disabled]}
            >
              <ChevronRight size={22} strokeWidth={2} color={colors.ink} />
            </Pressable>
          </>
        }
      />
      <ScrollView
        contentContainerStyle={styles.main}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => void refetch()} />}
      >
        <Card style={styles.meters}>
          <Meter stacked variant="calories" value={sum.kcal} target={kcalTarget} />
          <Meter stacked variant="protein" value={sum.protein_g} target={proteinTarget} />
        </Card>

        {date === today && ai.ready ? (
          <SuggestionCard
            defaultMeal={nowMeal}
            current={suggestion.current}
            loading={suggestion.loading}
            error={suggestion.error}
            onAsk={(meal) => void suggestion.ask(meal)}
            onOther={() => void suggestion.next()}
            onClose={() => void suggestion.dismiss()}
            onAdd={(meal, option) => {
              addMany(meal, option.items, 'suggestion');
              void suggestion.dismiss();
            }}
          />
        ) : null}

        <View style={styles.meals}>
          {MEALS.map((meal, i) => (
            <MealSection
              key={meal.key}
              title={meal.label}
              divider={i > 0}
              entries={
                loading
                  ? []
                  : day.entries
                      .filter((e) => e.meal === meal.key)
                      .map((e) => ({
                        key: e.client_id,
                        name: e.food_name,
                        quantity: formatQty(e.qty),
                        kcal: entryKcal(e),
                        protein: entryProtein(e),
                      }))
              }
              onEditEntry={(key) => setEditing(day.entries.find((e) => e.client_id === key) ?? null)}
            />
          ))}
        </View>
        {day.entries.length ? <Text style={[type.secondary, styles.hint]}>Tap an item to change the amount or delete it.</Text> : null}
      </ScrollView>

      <ExtendedFab label="Add food" onPress={() => setAdding(true)} style={[styles.fab, { bottom: notice ? 76 : 16 }]} />
      <View style={styles.snackbar} pointerEvents="box-none">
        <Snackbar
          message={notice?.message ?? null}
          actionLabel={notice?.undo ? 'Undo' : undefined}
          onAction={notice?.undo}
          onDismiss={() => setNotice(null)}
        />
      </View>

      {adding ? (
        <AddFoodSheet
          visible
          initialMeal={nowMeal}
          foods={foods}
          ai={ai}
          onAdd={add}
          onAddMany={addMany}
          onClose={() => setAdding(false)}
        />
      ) : null}
      {editing ? (
        <EditEntrySheet
          entry={editing}
          onClose={() => setEditing(null)}
          onDelete={() => remove(editing)}
          onSave={(qty) => {
            void updateFoodDay(date, (d) => withQty(d, editing.client_id, qty));
            setEditing(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  main: { paddingHorizontal: 20, paddingBottom: 160, gap: 12 },
  meters: { flexDirection: 'row', gap: 16 },
  meals: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingVertical: 6,
  },
  fab: { position: 'absolute', right: 20 },
  snackbar: { position: 'absolute', left: 16, right: 16, bottom: 12 },
  hint: { paddingHorizontal: 4 },
});
