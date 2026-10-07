import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

interface Props {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}

/** Five 44-tall buttons labelled 1 to 5; the selected one is accent. */
export function RatingRow({ label, value, onChange }: Props) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => {
        const selected = n === value;
        return (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={`${label} ${n} of 5`}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(n)}
            style={[styles.button, selected && styles.selected]}
          >
            <Text style={[styles.text, selected && styles.textSelected]}>{n}</Text>
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
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  text: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.ink },
  textSelected: { color: colors.white },
});
