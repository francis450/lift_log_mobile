import { useNetInfo } from '@react-native-community/netinfo';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Profile, ProfileUpdate, Reminders } from '@/api/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SettingsGroup, SettingsRow } from '@/components/SettingsRow';
import { TextField } from '@/components/TextField';
import { TimePickerRow } from '@/components/TimePickerRow';
import { Toggle } from '@/components/Toggle';
import { NetworkError } from '@/api/client';
import { useProfile, useSaveProfile, useTimeZone } from '@/hooks/queries';
import { formatDayMonth, todayIn } from '@/lib/dates';
import { exportMyData } from '@/settings/export';
import { checkRange, formatNumber, parseNumber, RangeCheck, RULES } from '@/lib/numbers';
import { formatKcal } from '@/lib/targets';
import { useAuth } from '@/state/auth';
import { syncQueue } from '@/sync';
import { colors, type } from '@/theme';

type EditField = 'kcal_target' | 'protein_target_g' | 'weight_kg' | 'height_cm' | 'age';

const EDITS: Record<EditField, { title: string; label: string; rule: RangeCheck; decimal?: boolean }> = {
  kcal_target: { title: 'Calories', label: 'Daily calories (kcal)', rule: { min: 1000, max: 6000, label: 'calorie target', unit: 'kcal', required: true } },
  protein_target_g: { title: 'Protein', label: 'Daily protein (g)', rule: { min: 30, max: 400, label: 'protein target', unit: 'g', required: true } },
  weight_kg: { title: 'Weight', label: 'Weight (kg)', rule: RULES.weight, decimal: true },
  height_cm: { title: 'Height', label: 'Height (cm)', rule: RULES.height },
  age: { title: 'Age', label: 'Age', rule: RULES.age },
};

export default function SettingsScreen() {
  const { data: profile } = useProfile();
  const save = useSaveProfile();
  const [editing, setEditing] = useState<EditField | null>(null);
  const credentials = useAuth((s) => s.credentials);
  const signOut = useAuth((s) => s.signOut);
  const net = useNetInfo();
  const pending = useQuery({ queryKey: ['outbox-count'], queryFn: () => syncQueue.pending(), refetchInterval: 5000 });

  const [exporting, setExporting] = useState(false);
  const tz = useTimeZone();
  async function runExport() {
    if (!credentials) return;
    setExporting(true);
    try {
      await exportMyData(credentials, todayIn(tz));
    } catch (e) {
      Alert.alert(
        "Couldn't export",
        e instanceof NetworkError ? 'Exporting needs a connection to your server.' : (e as Error).message,
      );
    } finally {
      setExporting(false);
    }
  }

  function update(values: ProfileUpdate) {
    save.mutate(values, { onError: (e) => Alert.alert("Couldn't save", (e as Error).message) });
  }

  function confirmSignOut() {
    const waiting = pending.data ?? 0;
    Alert.alert(
      'Sign out?',
      waiting
        ? `${waiting} ${waiting === 1 ? 'change hasn’t' : 'changes haven’t'} synced yet and will be lost.`
        : 'You can sign in again any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ],
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScreenHeader title="Settings" onBack />
      </SafeAreaView>
    );
  }

  const program = profile.program;
  const reminders = profile.reminders;
  const setReminder = (key: keyof Reminders, on: boolean) => update({ reminders: { ...reminders, [key]: on } });
  const host = credentials?.server.replace(/^https:\/\//, '') ?? '';
  const connection =
    net.isConnected === false ? 'Offline' : pending.data ? `${pending.data} waiting to sync` : 'Connected';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScreenHeader title="Settings" onBack />
      <ScrollView contentContainerStyle={styles.main}>
        <SettingsGroup title="Daily targets">
          <SettingsRow
            first
            label="Calories"
            sub="Lower by 150–200 if your weight stalls for 2 weeks."
            value={`${formatKcal(profile.kcal_target ?? 2200)} kcal`}
            onPress={() => setEditing('kcal_target')}
          />
          <SettingsRow
            label="Protein"
            sub="About 1.8 g per kg"
            value={profile.protein_target_g ? `${profile.protein_target_g} g` : 'Add weight'}
            onPress={() => setEditing('protein_target_g')}
          />
        </SettingsGroup>

        <SettingsGroup title="Body">
          <SettingsRow first label="Weight" value={profile.weight_kg ? `${formatNumber(profile.weight_kg)} kg` : 'Add'} onPress={() => setEditing('weight_kg')} />
          <SettingsRow label="Height" value={profile.height_cm ? `${profile.height_cm} cm` : 'Add'} onPress={() => setEditing('height_cm')} />
          <SettingsRow label="Age" value={profile.age ? `${profile.age}` : 'Add'} onPress={() => setEditing('age')} />
        </SettingsGroup>

        <SettingsGroup title="Training">
          <SettingsRow
            first
            label="Program"
            sub={program ? `${formatDayMonth(program.start_date)} – ${formatDayMonth(program.end_date)}` : undefined}
            value={program?.name ?? 'None'}
          />
          <TimePickerRow
            label="Session time"
            value={profile.session_time ?? '18:00'}
            onChange={(session_time) => update({ session_time })}
          />
          <SettingsRow label="Units" value="kg" />
        </SettingsGroup>

        <SettingsGroup title="Reminders">
          <SettingsRow
            first
            label="Before workout"
            sub="30 min before"
            control={<Toggle accessibilityLabel="Before workout" value={reminders.workout} onChange={(on) => setReminder('workout', on)} />}
          />
          <SettingsRow
            label="Log dinner"
            sub="8:00 PM if dinner is empty"
            control={<Toggle accessibilityLabel="Log dinner" value={reminders.dinner} onChange={(on) => setReminder('dinner', on)} />}
          />
          <SettingsRow
            label="Sunday check-in"
            sub="9:00 AM"
            control={<Toggle accessibilityLabel="Sunday check-in" value={reminders.checkin} onChange={(on) => setReminder('checkin', on)} />}
          />
        </SettingsGroup>

        <SettingsGroup title="Account">
          <SettingsRow first label="Server" sub={host} value={connection} />
          <SettingsRow
            label="AI features"
            sub="Photo estimates, suggestions, weekly review"
            control={
              <Toggle
                accessibilityLabel="AI features"
                value={profile.ai_enabled}
                onChange={(on) => update({ ai_enabled: on ? 1 : 0 })}
              />
            }
          />
        </SettingsGroup>

        <View style={styles.footer}>
          <Button
            variant="secondary"
            label="Export my data"
            height={48}
            loading={exporting}
            onPress={runExport}
            style={styles.flex}
          />
          <Button variant="danger" label="Sign out" onPress={confirmSignOut} height={48} style={styles.flex} />
        </View>
      </ScrollView>

      {editing ? (
        <EditSheet
          field={editing}
          profile={profile}
          onClose={() => setEditing(null)}
          onSave={(values) => {
            update(values);
            setEditing(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function EditSheet({
  field,
  profile,
  onClose,
  onSave,
}: {
  field: EditField;
  profile: Profile;
  onClose: () => void;
  onSave: (values: ProfileUpdate) => void;
}) {
  const edit = EDITS[field];
  const [text, setText] = useState(formatNumber(profile[field]));
  const [touched, setTouched] = useState(false);
  const value = parseNumber(text);
  const error = checkRange(value, edit.rule);
  const isTarget = field === 'kcal_target' || field === 'protein_target_g';
  const manual = field === 'kcal_target' ? profile.kcal_target_manual : profile.protein_target_manual;

  function submit() {
    setTouched(true);
    if (error) return;
    onSave({ [field]: value } as ProfileUpdate);
  }

  return (
    <BottomSheet visible title={edit.title} onClose={onClose}>
      <TextField
        label={edit.label}
        variant="numeric"
        value={text}
        onChangeText={setText}
        keyboardType={edit.decimal ? 'decimal-pad' : 'number-pad'}
        autoFocus
        error={touched ? error : null}
        onSubmitEditing={submit}
      />
      {isTarget ? (
        <Text style={type.secondary}>
          {manual
            ? 'Set by hand. It no longer follows your weight, height and age.'
            : 'Automatic: it follows your weight, height and age. Saving a number here sets it by hand.'}
        </Text>
      ) : null}
      <View style={styles.sheetButtons}>
        <Button label="Save" onPress={submit} />
        {isTarget && manual ? (
          <Button
            variant="secondary"
            label="Use automatic target"
            onPress={() => onSave(field === 'kcal_target' ? { kcal_target_manual: 0 } : { protein_target_manual: 0 })}
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  main: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  footer: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  sheetButtons: { gap: 10 },
});
