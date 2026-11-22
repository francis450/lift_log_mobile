import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

/** Reps in reserve: 0 = nothing left, 4 = four or more left. */
const RIR: { value: number; label: string; hint: string }[] = [
  { value: 0, label: '0', hint: 'nothing left, or missed a rep' },
  { value: 1, label: '1', hint: '1 more rep left' },
  { value: 2, label: '2', hint: '2 more reps left' },
  { value: 3, label: '3', hint: '3 more reps left' },
  { value: 4, label: '4+', hint: '4 or more reps left' },
];

function tone(rir: number): { fg: string; bg: string } {
  if (rir === 0) return { fg: colors.hold, bg: colors.holdSoft };
  if (rir >= 3) return { fg: colors.up, bg: colors.upSoft };
  return { fg: colors.accent, bg: colors.accentSoft };
}

interface Props {
  rir: number | null;
  warmup: boolean;
  onRir: (value: number | null) => void;
  onWarmup: (value: boolean) => void;
}

/**
 * Under a done set: a Warm-up toggle, then "Reps left" 0, 1, 2, 3, 4+. Tapping the selected value
 * clears it. A warm-up needs no rating, so the numbers hide while it's on.
 */
export function SetRating({ rir, warmup, onRir, onWarmup }: Props) {
  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Warm-up set"
        accessibilityState={{ checked: warmup }}
        onPress={() => onWarmup(!warmup)}
        hitSlop={{ top: 4, bottom: 4 }}
        style={[styles.warmup, warmup && styles.warmupOn]}
      >
        <Text style={[styles.text, { color: warmup ? colors.accent : colors.ink2 }]}>Warm-up</Text>
      </Pressable>
      {warmup ? null : (
        <View accessibilityRole="radiogroup" accessibilityLabel="Reps left" style={styles.rir}>
          {RIR.map((o) => {
            const selected = o.value === rir;
            const t = tone(o.value);
            return (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityLabel={`Reps left ${o.label}: ${o.hint}`}
                accessibilityState={{ checked: selected }}
                onPress={() => onRir(selected ? null : o.value)}
                hitSlop={{ top: 4, bottom: 4 }}
                style={[styles.button, selected && { backgroundColor: t.bg, borderColor: t.fg }]}
              >
                <Text style={[styles.text, { color: selected ? t.fg : colors.ink2 }]}>{o.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  rir: { flex: 1, flexDirection: 'row', gap: 6 },
  button: {
    flex: 1,
    height: 36,
    minWidth: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmup: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warmupOn: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  text: { fontFamily: fonts.bodySemi, fontSize: 14 },
});
