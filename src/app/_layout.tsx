import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Snackbar } from '@/components/Snackbar';
import { useAuth } from '@/state/auth';
import { useNotice } from '@/state/notice';
import { queryClient } from '@/state/queryClient';
import { startSync } from '@/sync';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

function GlobalNotice() {
  const message = useNotice((s) => s.message);
  const clear = useNotice((s) => s.clear);
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.notice, { bottom: 92 + insets.bottom }]}>
      <Snackbar message={message} onDismiss={clear} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_500Medium,
  });
  const status = useAuth((s) => s.status);
  const hasProfile = useAuth((s) => s.hasProfile);

  useEffect(() => {
    void useAuth.getState().restore();
  }, []);

  useEffect(() => {
    if (status === 'signedIn') return startSync();
  }, [status]);

  const ready = fontsLoaded && status !== 'loading';
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const signedIn = status === 'signedIn';
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
          <Stack.Protected guard={signedIn && !hasProfile}>
            <Stack.Screen name="setup" />
          </Stack.Protected>
          <Stack.Protected guard={signedIn && hasProfile}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="workout" />
            <Stack.Screen name="session/[date]" />
            <Stack.Screen name="history" />
          </Stack.Protected>
        </Stack>
        <GlobalNotice />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  notice: { position: 'absolute', left: 16, right: 16 },
});
