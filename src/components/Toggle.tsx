import { Pressable, StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

interface Props {
  value: boolean;
  onChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

/** 52 x 32 track (accent on, grey off) with a 24 px white knob. */
export function Toggle({ value, onChange, accessibilityLabel, disabled }: Props) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      hitSlop={6}
      style={[styles.track, { backgroundColor: value ? colors.accent : colors.toggleOff }, disabled && styles.disabled]}
    >
      <View style={[styles.knob, { left: value ? 24 : 4 }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { width: 52, height: 32, borderRadius: 16 },
  knob: { position: 'absolute', top: 4, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white },
  disabled: { opacity: 0.5 },
});
