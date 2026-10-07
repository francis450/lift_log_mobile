import { StatusBar } from 'expo-status-bar';
import { Dumbbell } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/state/auth';
import { colors, fonts, radii } from '@/theme';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const signIn = useAuth((s) => s.signIn);
  const lastServer = useAuth((s) => s.lastServer);
  const [server, setServer] = useState(lastServer ?? 'https://');
  const [usr, setUsr] = useState('');
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usrRef = useRef<TextInput>(null);
  const pwdRef = useRef<TextInput>(null);

  async function submit() {
    if (!usr.trim() || !pwd) {
      setError('Enter your email or username and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(server, usr, pwd);
    } catch (e) {
      // Show the server's own message: wrong password, missing role, site unreachable.
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
        <View style={[styles.hero, { paddingTop: 72 + insets.top }]}>
          <View style={styles.logo}>
            <Dumbbell size={34} strokeWidth={2} color={colors.white} />
          </View>
          <Text accessibilityRole="header" style={styles.brand}>
            Lift Log
          </Text>
          <Text style={styles.tagline}>
            Log every set and every meal. Know when to add weight. Review the week with Claude.
          </Text>
        </View>

        <View style={[styles.form, { paddingBottom: 28 + insets.bottom }]}>
          <Text style={styles.formTitle}>Sign in to your server</Text>
          <TextField
            label="Server address"
            value={server}
            onChangeText={setServer}
            keyboardType="url"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => usrRef.current?.focus()}
          />
          <TextField
            ref={usrRef}
            label="Email or username"
            value={usr}
            onChangeText={setUsr}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            returnKeyType="next"
            onSubmitEditing={() => pwdRef.current?.focus()}
          />
          <TextField
            ref={pwdRef}
            label="Password"
            value={pwd}
            onChangeText={setPwd}
            secureTextEntry
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={submit}
          />
          <Text style={styles.help}>Your ERPNext login. Your data stays on that site, in the Lift Log app.</Text>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <Button label="Sign in" onPress={submit} loading={busy} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  scroll: { flexGrow: 1 },
  hero: { flex: 1, paddingHorizontal: 28, paddingBottom: 24, gap: 18 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { fontFamily: fonts.display, fontSize: 52, lineHeight: 52, color: colors.white },
  tagline: { fontFamily: fonts.body, fontSize: 17, lineHeight: 25, color: colors.onDarkMuted, maxWidth: 300 },
  form: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 14,
  },
  formTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  help: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.ink2 },
  error: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.danger,
    backgroundColor: '#FBE9E7',
    borderRadius: 10,
    padding: 10,
  },
});
