import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '@/theme';

interface Props {
  message: string | null;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  durationMs?: number;
}

/** Dark bar with white text and an optional light-accent action ("Undo"). Hides itself after 5 s. */
export function Snackbar({ message, actionLabel, onAction, onDismiss, durationMs = 5000 }: Props) {
  // The timer restarts only for a new message, not when the parent re-renders.
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => dismiss.current(), durationMs);
    return () => clearTimeout(timer);
  }, [message, durationMs]);

  if (!message) return null;
  return (
    <View accessibilityLiveRegion="polite" style={styles.bar}>
      <Text style={styles.text}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onAction();
            onDismiss();
          }}
          style={styles.action}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    paddingLeft: 16,
    paddingRight: 8,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.white, paddingVertical: 12 },
  action: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, justifyContent: 'center' },
  actionText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.accentOnDark },
});
