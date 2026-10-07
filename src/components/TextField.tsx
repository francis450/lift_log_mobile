import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';

import { colors, fonts, radii } from '@/theme';

interface Props extends TextInputProps {
  label: string;
  /** `numeric`: the compact mono field used for numbers (Setup, check-in). */
  variant?: 'default' | 'numeric';
  error?: string | null;
}

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, variant = 'default', error, style, ...input },
  ref,
) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label} nativeID={`label-${label}`}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityLabelledBy={`label-${label}`}
        placeholderTextColor={colors.ink3}
        style={[variant === 'numeric' ? styles.numeric : styles.input, error ? styles.invalid : null, style]}
        {...input}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: 6, flex: 1 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink2 },
  input: {
    height: 52,
    borderRadius: radii.inner,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 14,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  numeric: {
    height: 48,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    paddingHorizontal: 10,
    fontFamily: fonts.mono,
    fontSize: 17,
    color: colors.ink,
  },
  invalid: { borderColor: colors.danger },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.danger },
});
