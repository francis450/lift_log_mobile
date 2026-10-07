import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, type } from '@/theme';

import { Card } from './Card';
import { ScreenHeader } from './ScreenHeader';

/** Placeholder for tabs whose milestone isn't built yet. */
export function ComingSoon({ title, body, pushed }: { title: string; body: string; pushed?: boolean }) {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title={title} onBack={pushed ? true : undefined} />
      <View style={styles.body}>
        <Card>
          <Text style={type.body}>{body}</Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { paddingHorizontal: 20 },
});
