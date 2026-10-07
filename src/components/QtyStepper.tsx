import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

interface Props {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
}

/** − value + in half portions. */
export function QtyStepper({ value, onChange, step = 0.5, min = 0.5 }: Props) {
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fewer portions"
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, Math.round((value - step) * 2) / 2))}
        style={[styles.button, value <= min && styles.disabled]}
      >
        <Text style={styles.sign}>−</Text>
      </Pressable>
      <Text accessibilityLabel={`${shown} portions`} style={styles.value}>
        {shown}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="More portions"
        onPress={() => onChange(Math.round((value + step) * 2) / 2)}
        style={styles.button}
      >
        <Text style={styles.sign}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  sign: { fontFamily: fonts.body, fontSize: 20, color: colors.ink },
  value: { fontFamily: fonts.mono, fontSize: 18, minWidth: 36, textAlign: 'center', color: colors.ink },
});
