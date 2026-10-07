import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, radii } from '@/theme';

interface Props {
  setNo: number;
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
  return (
    <View style={styles.row}>
      <Text style={styles.setNo}>{setNo}</Text>
      {showKg ? (
        <TextInput
          accessibilityLabel={`Set ${setNo} weight in kg`}
          value={kg}
          onChangeText={onChangeKg}
          keyboardType="decimal-pad"
          style={fieldStyle}
        />
      ) : null}
      <TextInput
        accessibilityLabel={`Set ${setNo} ${repsLabel}`}
        value={reps}
        onChangeText={onChangeReps}
        placeholder={repsPlaceholder}
        placeholderTextColor={colors.ink3}
        keyboardType="number-pad"
        style={fieldStyle}
      />
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`Set ${setNo} done`}
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
