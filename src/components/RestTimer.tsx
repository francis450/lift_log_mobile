import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, type } from '@/theme';

export function formatSeconds(total: number): string {
  const s = Math.max(0, Math.round(total));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

interface Props {
  secondsLeft: number;
  onAdd30: () => void;
  onSkip: () => void;
}

/** Dark card with a mono countdown, "+30 s" outline button and white "Skip". */
export function RestTimer({ secondsLeft, onAdd30, onSkip }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.text}>
        <Text style={[type.eyebrow, styles.eyebrow]}>Rest</Text>
        <Text accessibilityLiveRegion="polite" style={styles.time}>
          {formatSeconds(secondsLeft)}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Add 30 seconds" onPress={onAdd30} style={styles.outline}>
        <Text style={styles.outlineText}>+30 s</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Skip rest" onPress={onSkip} style={styles.skip}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.ink,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  text: { flex: 1 },
  eyebrow: { color: colors.onDarkMuted },
  time: { fontFamily: fonts.mono, fontSize: 30, color: colors.white },
  outline: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.onDarkMuted,
    justifyContent: 'center',
  },
  outlineText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.white },
  skip: { height: 44, paddingHorizontal: 16, borderRadius: 12, backgroundColor: colors.white, justifyContent: 'center' },
  skipText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
});
