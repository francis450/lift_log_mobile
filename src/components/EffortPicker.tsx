import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

export type Effort = 'easy' | 'right' | 'hard';

const OPTIONS: { value: Effort; label: string; fg: string; bg: string; hint: string }[] = [
  { value: 'easy', label: 'Easy', fg: colors.up, bg: colors.upSoft, hint: '3 or more reps left' },
  { value: 'right', label: 'Right', fg: colors.accent, bg: colors.accentSoft, hint: '1 to 2 reps left' },
  { value: 'hard', label: 'Hard', fg: colors.hold, bg: colors.holdSoft, hint: 'Nothing left or missed reps' },
];

interface Props {
  value: Effort | null;
  onChange: (value: Effort | null) => void;
}

/** Three equal buttons under a done set. Tapping the selected one clears it (effort is optional). */
export function EffortPicker({ value, onChange }: Props) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Effort" style={styles.row}>
      {OPTIONS.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={`${o.label}: ${o.hint}`}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(selected ? null : o.value)}
            hitSlop={{ top: 4, bottom: 4 }}
            style={[styles.button, selected && { backgroundColor: o.bg, borderColor: o.fg }]}
          >
            <Text style={[styles.text, { color: selected ? o.fg : colors.ink2 }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  button: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontFamily: fonts.bodySemi, fontSize: 14 },
});
