import { Camera } from 'lucide-react-native';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { colors, fonts } from '@/theme';

interface Props {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** 56 tall, radius 16, accent, camera icon + label, with a shadow. */
export function ExtendedFab({ label, onPress, style }: Props) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.fab, style]}>
      <Camera size={22} strokeWidth={2} color={colors.white} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 18,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-end',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  label: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.white },
});
