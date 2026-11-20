import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FoodEntry } from '@/api/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { QtyStepper } from '@/components/QtyStepper';
import { TextField } from '@/components/TextField';
import { checkRange, formatNumber, parseNumber } from '@/lib/numbers';
import { formatKcal } from '@/lib/targets';
import { colors, fonts, type } from '@/theme';

import { entryGramsPerPortion, qtyFromGrams } from './model';

interface Props {
  entry: FoodEntry;
  onSave: (qty: number, grams?: number | null) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Tap an entry: change the amount (portions, or grams for a weighed entry), or delete it. */
export function EditEntrySheet({ entry, onSave, onDelete, onClose }: Props) {
  const [qty, setQty] = useState(entry.qty);
  const gpp = entryGramsPerPortion(entry);
  const [grams, setGrams] = useState(formatNumber(entry.grams));
  const g = parseNumber(grams);
  const gramsError = gpp ? checkRange(g, { min: 1, max: 5000, label: 'weight', unit: 'g', required: true }) : null;
  const amount = gpp && g && !gramsError ? qtyFromGrams(g, gpp) : qty;
  const changed = gpp ? g !== entry.grams && !gramsError : qty !== entry.qty;
  return (
    <BottomSheet visible title={entry.food_name} onClose={onClose}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={type.secondary}>{entry.portion || 'Portion'}</Text>
          <Text style={styles.total}>
            {formatKcal(entry.kcal_per_portion * amount)} kcal · {Math.round(entry.protein_per_portion * amount)} g protein
          </Text>
        </View>
        {gpp ? (
          <View style={styles.grams}>
            <TextField
              label="Weighed (g)"
              variant="numeric"
              value={grams}
              onChangeText={setGrams}
              keyboardType="decimal-pad"
              error={gramsError}
            />
          </View>
        ) : (
          <QtyStepper value={qty} onChange={setQty} />
        )}
      </View>
      <Button label="Save" onPress={() => onSave(amount, gpp ? g : undefined)} disabled={!changed} />
      <Button variant="danger" label="Delete" onPress={onDelete} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  grams: { width: 120 },
  total: { fontFamily: fonts.mono, fontSize: 14, color: colors.ink },
});
