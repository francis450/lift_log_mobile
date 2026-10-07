import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, type } from '@/theme';

interface Props {
  label: string;
  sub?: string;
  value?: string;
  onPress?: () => void;
  /** Right-hand control instead of a value, e.g. a Toggle. */
  control?: ReactNode;
  first?: boolean;
}

export function SettingsRow({ label, sub, value, onPress, control, first }: Props) {
  const content = (
    <>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {sub ? <Text style={[type.secondary, styles.sub]}>{sub}</Text> : null}
      </View>
      {control ?? (value !== undefined ? <Text style={styles.value}>{onPress ? `${value} ›` : value}</Text> : null)}
    </>
  );
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}${value ? `: ${value}` : ''}`}
        onPress={onPress}
        style={[styles.row, !first && styles.divider]}
      >
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.row, !first && styles.divider]}>{content}</View>;
}

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={[type.eyebrow, styles.groupTitle]}>{title}</Text>
      <View style={styles.box}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  groupTitle: { paddingHorizontal: 4 },
  box: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    overflow: 'hidden',
  },
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.track },
  text: { flexShrink: 1, gap: 1 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
  sub: { fontSize: 12, lineHeight: 16 },
  value: { fontFamily: fonts.mono, fontSize: 14, color: colors.ink2 },
});
