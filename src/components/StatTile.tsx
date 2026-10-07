import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radii } from '@/theme';

/** Small card with a Barlow number and a short caption. */
export function StatTile({ value, caption }: { value: string; caption: string }) {
  return (
    <View accessible accessibilityLabel={`${caption}: ${value}`} style={styles.tile}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.caption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.inner,
    padding: 12,
    gap: 2,
  },
  value: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30, color: colors.ink },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.ink2 },
});
