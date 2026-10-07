import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { FoodEntry } from '@/api/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { QtyStepper } from '@/components/QtyStepper';
import { formatKcal } from '@/lib/targets';
import { colors, fonts, type } from '@/theme';

interface Props {
  entry: FoodEntry;
  onSave: (qty: number) => void;
  onDelete: () => void;
  onClose: () => void;
}

/** Long-press an entry: change the number of portions, or delete it. */
export function EditEntrySheet({ entry, onSave, onDelete, onClose }: Props) {
  const [qty, setQty] = useState(entry.qty);
  return (
    <BottomSheet visible title={entry.food_name} onClose={onClose}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={type.secondary}>{entry.portion || 'Portion'}</Text>
          <Text style={styles.total}>
            {formatKcal(entry.kcal_per_portion * qty)} kcal · {Math.round(entry.protein_per_portion * qty)} g protein
          </Text>
        </View>
        <QtyStepper value={qty} onChange={setQty} />
      </View>
      <Button label="Save" onPress={() => onSave(qty)} disabled={qty === entry.qty} />
      <Button variant="danger" label="Delete" onPress={onDelete} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  total: { fontFamily: fonts.mono, fontSize: 14, color: colors.ink },
});
