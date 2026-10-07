import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, type } from '@/theme';

interface Props {
  title: string;
  eyebrow?: string;
  right?: ReactNode;
  /** Pushed screens get a back button and a smaller title. */
  onBack?: (() => void) | true;
}

export function ScreenHeader({ title, eyebrow, right, onBack }: Props) {
  if (onBack) {
    return (
      <View style={styles.pushed}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack === true ? () => router.back() : onBack}
          style={styles.back}
        >
          <ChevronLeft size={24} color={colors.ink} strokeWidth={2} />
        </Pressable>
        <Text accessibilityRole="header" style={[type.pushedTitle, styles.flex]}>
          {title}
        </Text>
        {right}
      </View>
    );
  }
  return (
    <View style={styles.root}>
      <View style={styles.titles}>
        {eyebrow ? <Text style={type.eyebrow}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" style={type.screenTitle}>
          {title}
        </Text>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  titles: { gap: 2, flexShrink: 1 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pushed: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
