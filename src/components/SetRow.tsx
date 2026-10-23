import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, radii } from '@/theme';

interface Props {
  setNo: number;
  /** Per-side exercises: the row's side, shown after the set number ("1L", "1R"). */
  side?: 'L' | 'R';
  /** "kg" or "kg per dumbbell", for the weight field's label. */
  kgLabel?: string;
  kg: string;
  reps: string;
  /** Last session's reps, shown as placeholder text. */
  repsPlaceholder?: string;
  done: boolean;
  active?: boolean;
  /** Bodyweight and time exercises have no weight field. */
  showKg?: boolean;
  repsLabel?: string;
  onChangeKg: (value: string) => void;
  onChangeReps: (value: string) => void;
  onToggleDone: () => void;
}

/** Set number, kg field, reps field (48 tall, mono 18) and a 48 x 48 tick. */
export function SetRow({
  setNo,
  side,
  kgLabel = 'kg',
  kg,
  reps,
  repsPlaceholder,
  done,
  active,
  showKg = true,
  repsLabel = 'reps',
  onChangeKg,
  onChangeReps,
  onToggleDone,
}: Props) {
  const fieldStyle = [styles.field, done && styles.fieldDone, active && !done && styles.fieldActive];
  const name = side ? `Set ${setNo} ${side === 'L' ? 'left' : 'right'}` : `Set ${setNo}`;
  return (
    <View style={styles.row}>
      <Text style={[styles.setNo, side && styles.setNoSide]}>
        {setNo}
        {side ?? ''}
      </Text>
      {showKg ? (
        <TextInput
          accessibilityLabel={`${name} weight in ${kgLabel}`}
          value={kg}
          onChangeText={onChangeKg}
          keyboardType="decimal-pad"
          style={fieldStyle}
        />
      ) : null}
      <TextInput
        accessibilityLabel={`${name} ${repsLabel}`}
        value={reps}
        onChangeText={onChangeReps}
        placeholder={repsPlaceholder}
        placeholderTextColor={colors.ink3}
        keyboardType="number-pad"
        style={fieldStyle}
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`${name} done`}
        accessibilityState={{ checked: done }}
        onPress={onToggleDone}
        style={[styles.tick, done && styles.tickDone]}
      >
        <Check size={22} strokeWidth={2} color={done ? colors.white : colors.ink3} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setNo: { width: 24, fontFamily: fonts.mono, fontSize: 15, color: colors.ink3, textAlign: 'center' },
  setNoSide: { width: 32 },
  field: {
    flex: 1,
    height: 48,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    fontFamily: fonts.mono,
    fontSize: 18,
    color: colors.ink,
    textAlign: 'center',
  },
  fieldDone: { backgroundColor: colors.surface2, color: colors.ink2 },
  fieldActive: { borderColor: colors.accent, borderWidth: 2 },
  tick: {
    width: 48,
    height: 48,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickDone: { backgroundColor: colors.up, borderColor: colors.up },
});
