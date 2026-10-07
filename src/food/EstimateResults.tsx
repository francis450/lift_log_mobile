import { Check } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors, fonts, type } from '@/theme';

import { addFoodsLabel, chosenItems, EstimateRow } from './model';

interface Props {
  rows: EstimateRow[];
  onChange: (rows: EstimateRow[]) => void;
  summary: string;
  photoUri?: string;
  onRetake?: () => void;
  onAdd: () => void;
}

/** "Found 3 foods": tick what you ate, fix any number, then "Add 3 foods · 610 kcal · 34 g". */
export function EstimateResults({ rows, onChange, summary, photoUri, onRetake, onAdd }: Props) {
  const chosen = chosenItems(rows);
  const update = (i: number, patch: Partial<EstimateRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.thumb} accessibilityLabel="Your meal photo" /> : null}
        <View style={styles.flex}>
          <Text style={styles.found}>
            {rows.length ? `Found ${rows.length} ${rows.length === 1 ? 'food' : 'foods'}` : 'No foods found'}
          </Text>
          <Text style={type.secondary}>{rows.length ? summary : 'Try another photo or describe the meal instead.'}</Text>
          {onRetake ? (
            <Pressable accessibilityRole="button" onPress={onRetake} style={styles.retake}>
              <Text style={styles.retakeText}>{photoUri ? 'Retake photo' : 'Start again'}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {rows.length ? (
        <View style={styles.table}>
          <View style={[styles.row, styles.header]}>
            <View style={styles.boxCol} />
            <Text style={[styles.th, styles.flex]}>Food</Text>
            <Text style={[styles.th, styles.numCol]}>kcal</Text>
            <Text style={[styles.th, styles.numCol]}>Prot. g</Text>
          </View>
          {rows.map((r, i) => (
            <View key={`${r.item.food_name}-${i}`} style={styles.row}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={r.item.food_name}
                accessibilityState={{ checked: r.checked }}
                onPress={() => update(i, { checked: !r.checked })}
                style={styles.boxCol}
                hitSlop={8}
              >
                <View style={[styles.box, r.checked && styles.boxOn]}>
                  {r.checked ? <Check size={14} strokeWidth={2} color={colors.white} /> : null}
                </View>
              </Pressable>
              <View style={styles.flex}>
                <Text style={styles.name}>{r.item.food_name}</Text>
                {r.item.portion ? <Text style={styles.portion}>{r.item.portion}</Text> : null}
              </View>
              <TextInput
                accessibilityLabel={`${r.item.food_name} kcal`}
                value={r.kcal}
                onChangeText={(kcal) => update(i, { kcal })}
                keyboardType="number-pad"
                style={[styles.input, styles.numCol]}
              />
              <TextInput
                accessibilityLabel={`${r.item.food_name} protein in grams`}
                value={r.protein}
                onChangeText={(protein) => update(i, { protein })}
                keyboardType="decimal-pad"
                style={[styles.input, styles.numCol, styles.protein]}
              />
            </View>
          ))}
        </View>
      ) : null}

      {rows.length ? <Button label={addFoodsLabel(chosen)} disabled={!chosen.length} onPress={onAdd} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  head: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 96, height: 96, borderRadius: 16, backgroundColor: colors.track },
  flex: { flex: 1, minWidth: 0 },
  found: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  retake: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retakeText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.accent },
  table: { borderWidth: 1, borderColor: colors.line, borderRadius: 16, overflow: 'hidden' },
  header: { backgroundColor: colors.surface2, minHeight: 32, borderTopWidth: 0 },
  th: { ...type.eyebrow, fontSize: 11 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 52,
    borderTopWidth: 1,
    borderTopColor: colors.track,
  },
  boxCol: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  name: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
  portion: { fontFamily: fonts.body, fontSize: 12, color: colors.ink3 },
  numCol: { width: 64, textAlign: 'right' },
  input: {
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    paddingHorizontal: 8,
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.ink,
  },
  protein: { color: colors.up },
});
