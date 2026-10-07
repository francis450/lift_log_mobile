import { StyleSheet, Text } from 'react-native';

import { colors, fonts, radii } from '@/theme';

export type CallKind = 'up' | 'hold' | 'start' | 'down';

const KIND: Record<CallKind, { bg: string; fg: string }> = {
  up: { bg: colors.upSoft, fg: colors.up },
  hold: { bg: colors.holdSoft, fg: colors.hold },
  start: { bg: colors.accentSoft, fg: colors.accent },
  down: { bg: colors.holdSoft, fg: colors.hold },
};

export function CallChip({ kind, label }: { kind: CallKind; label: string }) {
  const c = KIND[kind];
  return <Text style={[styles.chip, { backgroundColor: c.bg, color: c.fg }]}>{label}</Text>;
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.chip,
    overflow: 'hidden',
  },
});
