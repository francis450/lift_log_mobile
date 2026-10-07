import type { Tabs } from 'expo-router';
import { ChartColumn, Dumbbell, House, LucideIcon, Utensils } from 'lucide-react-native';
import { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/theme';

export type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; Icon: LucideIcon }> = {
  index: { label: 'Today', Icon: House },
  train: { label: 'Train', Icon: Dumbbell },
  food: { label: 'Food', Icon: Utensils },
  progress: { label: 'Progress', Icon: ChartColumn },
};

/** Material 3 style bar: 80 tall, active item has a 64 x 32 pill behind its icon. */
export function BottomNav({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { height: 80 + insets.bottom, paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={onPress}
            style={styles.item}
          >
            <View style={[styles.pill, focused && styles.pillActive]}>
              <tab.Icon size={22} strokeWidth={2} color={focused ? colors.accent : colors.ink2} />
            </View>
            <Text style={[styles.label, focused ? styles.labelActive : null]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  pill: { width: 64, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  pillActive: { backgroundColor: colors.accentSoft },
  label: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink2 },
  labelActive: { fontFamily: fonts.bodySemi, color: colors.ink },
});
