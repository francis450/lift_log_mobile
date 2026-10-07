import { X } from 'lucide-react-native';
import { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, type } from '@/theme';

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  /** Fraction of the screen height; the Add food sheet uses about 0.85. Omit to fit content. */
  heightFraction?: number;
}

/** Grab handle, title and close button, over a scrim. */
export function BottomSheet({ visible, title, onClose, heightFraction, children }: PropsWithChildren<Props>) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <Pressable accessibilityLabel="Close" style={styles.scrim} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { paddingBottom: 20 + insets.bottom },
            heightFraction ? { height: `${heightFraction * 100}%` } : null,
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[type.pushedTitle, styles.title]}>
              {title}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
              <X size={22} strokeWidth={2} color={colors.ink} />
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim, opacity: 0.6 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 14,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong },
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
