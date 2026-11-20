import { Search } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { EstimateItem, FoodItem, FoodSource, Meal } from '@/api/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { QtyStepper } from '@/components/QtyStepper';
import { Segmented } from '@/components/Segmented';
import { TextField } from '@/components/TextField';
import { Toggle } from '@/components/Toggle';
import { checkRange, parseNumber } from '@/lib/numbers';
import { formatKcal } from '@/lib/targets';
import { colors, fonts, radii, type } from '@/theme';

import { AiNotReady, DescribeTab, PhotoTab } from './AiTabs';
import { MEALS, mealLabel, qtyFromGrams, searchFoods } from './model';

type Tab = 'photo' | 'describe' | 'search' | 'custom';

export interface AddRequest {
  meal: Meal;
  item: Omit<FoodItem, 'name'>;
  qty: number;
  /** Kitchen-scale weight, when the food was weighed. */
  grams?: number | null;
  source: FoodSource;
  saveToMyFoods: boolean;
}

/** Grams from the scale for a food whose portion weight is known: qty follows the grams. */
function useWeighed(gramsPerPortion: number | null | undefined) {
  const [grams, setGrams] = useState('');
  const g = parseNumber(grams);
  const error = gramsPerPortion ? checkRange(g, { min: 1, max: 5000, label: 'weight', unit: 'g' }) : null;
  const qty = gramsPerPortion && g && !error ? qtyFromGrams(g, gramsPerPortion) : null;
  return { grams, setGrams, g: qty ? g : null, qty, error };
}

interface Props {
  visible: boolean;
  initialMeal: Meal;
  foods: { recent: FoodItem[]; mine: FoodItem[]; library: FoodItem[] };
  /** Photo and Describe need Claude on the server; when not ready they show this message instead. */
  ai: { ready: boolean; message: string | null };
  onAdd: (request: AddRequest) => void;
  onAddMany: (meal: Meal, items: EstimateItem[], source: FoodSource) => void;
  onClose: () => void;
}

export function AddFoodSheet({ visible, initialMeal, foods, ai, onAdd, onAddMany, onClose }: Props) {
  // Start on Photo (take or pick a photo, or switch tab) when AI is set up; otherwise on Search.
  const [tab, setTab] = useState<Tab>(ai.ready ? 'photo' : 'search');
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const notReady = ai.message ?? "AI features aren't set up on your server";
  return (
    <BottomSheet visible={visible} title="Add food" onClose={onClose} heightFraction={0.85}>
      <Segmented<Tab>
        options={[
          { value: 'photo', label: 'Photo' },
          { value: 'describe', label: 'Describe' },
          { value: 'search', label: 'Search' },
          { value: 'custom', label: 'Custom' },
        ]}
        value={tab}
        onChange={setTab}
      />
      <View accessibilityRole="radiogroup" accessibilityLabel="Meal" style={styles.meals}>
        {MEALS.map((m) => {
          const on = m.key === meal;
          return (
            <Pressable
              key={m.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setMeal(m.key)}
              style={[styles.mealChip, on && styles.mealChipOn]}
            >
              <Text style={[styles.mealText, on && styles.mealTextOn]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {tab === 'photo' ? (
        ai.ready ? <PhotoTab onAddMany={(items, source) => onAddMany(meal, items, source)} /> : <AiNotReady message={notReady} />
      ) : null}
      {tab === 'describe' ? (
        ai.ready ? <DescribeTab onAddMany={(items, source) => onAddMany(meal, items, source)} /> : <AiNotReady message={notReady} />
      ) : null}
      {tab === 'search' ? <SearchTab meal={meal} foods={foods} onAdd={onAdd} /> : null}
      {tab === 'custom' ? <CustomTab meal={meal} onAdd={onAdd} /> : null}
    </BottomSheet>
  );
}

function SearchTab({ meal, foods, onAdd }: { meal: Meal; foods: Props['foods']; onAdd: Props['onAdd'] }) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<FoodItem | null>(null);
  const [qty, setQty] = useState(1);
  const weighed = useWeighed(picked?.grams_per_portion);
  const amount = weighed.qty ?? qty;
  const groups = searchFoods(foods, query);
  const keyOf = (i: FoodItem) => `${i.food_name}|${i.portion}`;

  return (
    <View style={styles.flex}>
      <View style={styles.searchBox}>
        <Search size={20} strokeWidth={2} color={colors.ink3} />
        <TextInput
          accessibilityLabel="Search foods"
          value={query}
          onChangeText={setQuery}
          placeholder="Search foods"
          placeholderTextColor={colors.ink3}
          autoFocus
          autoCorrect={false}
          style={styles.searchInput}
        />
      </View>
      <ScrollView style={styles.results} keyboardShouldPersistTaps="handled">
        {groups.length === 0 ? (
          <Text style={[type.secondary, styles.noResults]}>No match. Add it on the Custom tab.</Text>
        ) : null}
        {groups.map((group) => (
          <View key={group.label}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.items.map((item) => {
              const on = !!picked && keyOf(picked) === keyOf(item);
              return (
                <Pressable
                  key={`${group.label}-${keyOf(item)}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${item.food_name}, ${item.portion}, ${item.kcal} kcal, ${item.protein_g} grams protein`}
                  onPress={() => {
                    setPicked(item);
                    setQty(1);
                    weighed.setGrams('');
                  }}
                  style={[styles.result, on && styles.resultOn]}
                >
                  <View style={styles.flex}>
                    <Text style={styles.resultName}>{item.food_name}</Text>
                    {item.portion ? <Text style={styles.resultPortion}>{item.portion}</Text> : null}
                  </View>
                  <Text style={styles.resultNumbers}>
                    {formatKcal(item.kcal)} kcal · {Math.round(item.protein_g)} g
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>
      {picked ? (
        <View style={styles.picker}>
          <View style={styles.flex}>
            <Text style={styles.pickName} numberOfLines={1}>
              {picked.food_name}
            </Text>
            <Text style={styles.pickTotal}>
              {formatKcal(picked.kcal * amount)} kcal · {Math.round(picked.protein_g * amount)} g protein
            </Text>
          </View>
          {picked.grams_per_portion ? (
            <View style={styles.grams}>
              <TextField
                label="Weighed (g)"
                variant="numeric"
                value={weighed.grams}
                onChangeText={weighed.setGrams}
                placeholder={`${picked.grams_per_portion} g = 1`}
                keyboardType="decimal-pad"
                error={weighed.grams ? weighed.error : null}
              />
            </View>
          ) : (
            <QtyStepper value={qty} onChange={setQty} />
          )}
        </View>
      ) : null}
      <Button
        label={`Add to ${mealLabel(meal)}`}
        disabled={!picked}
        onPress={() =>
          picked && onAdd({ meal, item: picked, qty: amount, grams: weighed.g, source: 'search', saveToMyFoods: false })
        }
      />
    </View>
  );
}

function CustomTab({ meal, onAdd }: { meal: Meal; onAdd: Props['onAdd'] }) {
  const [name, setName] = useState('');
  const [portion, setPortion] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [portionGrams, setPortionGrams] = useState('');
  const [qty, setQty] = useState(1);
  const [save, setSave] = useState(true);
  const [touched, setTouched] = useState(false);

  const k = parseNumber(kcal);
  const p = parseNumber(protein);
  const gpp = parseNumber(portionGrams);
  const gppError = checkRange(gpp, { min: 1, max: 5000, label: 'portion weight', unit: 'g' });
  const weighed = useWeighed(gppError ? null : gpp);
  const errors = {
    name: name.trim() ? null : 'Enter a name.',
    kcal: checkRange(k, { min: 0, max: 5000, label: 'kcal value', required: true }),
    protein: checkRange(p, { min: 0, max: 300, label: 'protein value', unit: 'g', required: true }),
    portionGrams: gppError,
    grams: weighed.grams ? weighed.error : null,
  };

  function submit() {
    setTouched(true);
    if (errors.name || errors.kcal || errors.protein || errors.portionGrams || errors.grams) return;
    onAdd({
      meal,
      item: { food_name: name.trim(), portion: portion.trim(), kcal: k!, protein_g: p!, grams_per_portion: gpp },
      qty: weighed.qty ?? qty,
      grams: weighed.g,
      source: 'custom',
      saveToMyFoods: save,
    });
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.custom} keyboardShouldPersistTaps="handled">
      <TextField label="Name" value={name} onChangeText={setName} placeholder="Beef samosa" error={touched ? errors.name : null} />
      <TextField label="Portion" value={portion} onChangeText={setPortion} placeholder="1 samosa (~50 g)" />
      <View style={styles.pair}>
        <TextField
          label="kcal per portion"
          variant="numeric"
          value={kcal}
          onChangeText={setKcal}
          keyboardType="number-pad"
          error={touched ? errors.kcal : null}
        />
        <TextField
          label="Protein (g) per portion"
          variant="numeric"
          value={protein}
          onChangeText={setProtein}
          keyboardType="decimal-pad"
          error={touched ? errors.protein : null}
        />
      </View>
      <View style={styles.pair}>
        <TextField
          label="Grams per portion"
          variant="numeric"
          value={portionGrams}
          onChangeText={setPortionGrams}
          placeholder="optional, e.g. 100"
          keyboardType="decimal-pad"
          error={touched ? errors.portionGrams : null}
        />
        {gpp && !gppError ? (
          <TextField
            label="Weighed (g)"
            variant="numeric"
            value={weighed.grams}
            onChangeText={weighed.setGrams}
            placeholder="from the scale"
            keyboardType="decimal-pad"
            error={touched ? errors.grams : null}
          />
        ) : null}
      </View>
      {weighed.qty === null ? (
        <View style={styles.rowBetween}>
          <Text style={type.bodyMedium}>Portions</Text>
          <QtyStepper value={qty} onChange={setQty} />
        </View>
      ) : null}
      <View style={styles.rowBetween}>
        <Text style={type.bodyMedium}>Save to my foods</Text>
        <Toggle accessibilityLabel="Save to my foods" value={save} onChange={setSave} />
      </View>
      <Button label={`Add to ${mealLabel(meal)}`} onPress={submit} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 12 },
  meals: { flexDirection: 'row', gap: 6 },
  mealChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealChipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  mealText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.ink },
  mealTextOn: { color: colors.white },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    borderRadius: radii.inner,
    borderWidth: 2,
    borderColor: colors.accent,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  results: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: 16 },
  noResults: { padding: 14 },
  groupLabel: { ...type.eyebrow, fontSize: 11, backgroundColor: colors.surface2, paddingHorizontal: 14, paddingVertical: 6 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.track,
    backgroundColor: colors.surface,
  },
  resultOn: { backgroundColor: colors.accentSoft },
  resultName: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  resultPortion: { fontFamily: fonts.body, fontSize: 12, color: colors.ink3 },
  resultNumbers: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink2 },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface2,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  pickTotal: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink2 },
  custom: { gap: 12, paddingBottom: 12 },
  grams: { width: 120 },
  pair: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
});
