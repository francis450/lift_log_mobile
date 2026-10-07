import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Goal, Profile } from '@/api/types';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { TimePickerRow } from '@/components/TimePickerRow';
import { useProfile, useSaveProfile } from '@/hooks/queries';
import { checkRange, formatNumber, parseNumber, RULES } from '@/lib/numbers';
import { formatKcal, kcalTarget, proteinTarget } from '@/lib/targets';
import { useAuth } from '@/state/auth';
import { colors, fonts, radii, type } from '@/theme';

const GOALS: Goal[] = ['Lose fat, get stronger', 'Build muscle', 'Maintain'];
const DAYS = [
  { key: 'mon', label: 'M', full: 'Monday' },
  { key: 'tue', label: 'T', full: 'Tuesday' },
  { key: 'wed', label: 'W', full: 'Wednesday' },
  { key: 'thu', label: 'T', full: 'Thursday' },
  { key: 'fri', label: 'F', full: 'Friday' },
  { key: 'sat', label: 'S', full: 'Saturday' },
  { key: 'sun', label: 'S', full: 'Sunday' },
];

export default function SetupScreen() {
  const profile = useProfile();
  if (profile.isError && !profile.data) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <Text style={[type.body, styles.centerText]}>{(profile.error as Error).message}</Text>
        <Button variant="secondary" label="Try again" onPress={() => profile.refetch()} />
      </SafeAreaView>
    );
  }
  if (!profile.data) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }
  return <SetupForm initial={profile.data} />;
}

function SetupForm({ initial }: { initial: Profile }) {
  const save = useSaveProfile();
  const setHasProfile = useAuth((s) => s.setHasProfile);

  // Prefilled from the server's defaults, or an existing profile.
  const [weight, setWeight] = useState(formatNumber(initial.weight_kg));
  const [height, setHeight] = useState(formatNumber(initial.height_cm));
  const [age, setAge] = useState(formatNumber(initial.age));
  const [goal, setGoal] = useState<Goal>(initial.goal);
  const [days, setDays] = useState<string[]>(initial.training_days.split(',').filter(Boolean));
  const [sessionTime, setSessionTime] = useState(initial.session_time ?? '18:00');
  const [showErrors, setShowErrors] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const w = parseNumber(weight);
  const h = parseNumber(height);
  const a = parseNumber(age);
  const errors = {
    weight: checkRange(w, RULES.weight),
    height: checkRange(h, RULES.height),
    age: checkRange(a, RULES.age),
  };
  const kcal = kcalTarget(w, h, a);
  const protein = proteinTarget(w);
  const programName = initial.program?.name ?? 'your plan';

  async function start() {
    setShowErrors(true);
    if (errors.weight || errors.height || errors.age) return;
    setError(null);
    try {
      await save.mutateAsync({
        weight_kg: w,
        height_cm: h,
        age: a,
        goal,
        training_days: DAYS.map((d) => d.key)
          .filter((k) => days.includes(k))
          .join(','),
        session_time: sessionTime,
      });
      await setHasProfile(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <View style={styles.header}>
          <View style={styles.steps}>
            <View style={styles.step} />
            <View style={styles.step} />
          </View>
          <Text style={type.eyebrow}>Step 2 of 2</Text>
          <Text accessibilityRole="header" style={styles.title}>
            About you and your plan
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, styles.numbers]}>
            <TextField
              label="Weight (kg)"
              variant="numeric"
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              error={showErrors ? errors.weight : null}
            />
            <TextField
              label="Height (cm)"
              variant="numeric"
              value={height}
              onChangeText={setHeight}
              placeholder="cm"
              keyboardType="number-pad"
              error={showErrors ? errors.height : null}
            />
            <TextField
              label="Age"
              variant="numeric"
              value={age}
              onChangeText={setAge}
              placeholder="years"
              keyboardType="number-pad"
              error={showErrors ? errors.age : null}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Goal</Text>
            <View accessibilityRole="radiogroup" style={styles.chips}>
              {GOALS.map((g) => {
                const on = g === goal;
                return (
                  <Pressable
                    key={g}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => setGoal(g)}
                    style={[styles.chip, on && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{g}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Training days</Text>
            <View style={styles.days}>
              {DAYS.map((d) => {
                const on = days.includes(d.key);
                return (
                  <Pressable
                    key={d.key}
                    accessibilityRole="checkbox"
                    accessibilityLabel={d.full}
                    accessibilityState={{ checked: on }}
                    onPress={() => setDays(on ? days.filter((k) => k !== d.key) : [...days, d.key])}
                    style={[styles.day, on && styles.dayOn]}
                  >
                    <Text style={[styles.dayText, on && styles.chipTextOn]}>{d.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.timeRow}>
              <TimePickerRow label="Session time" value={sessionTime} onChange={setSessionTime} first />
            </View>
          </View>

          <View style={styles.targets}>
            <Text style={[type.eyebrow, { color: colors.accent }]}>Your starting targets</Text>
            <Text style={styles.targetsValue}>
              {formatKcal(kcal)} kcal · {protein ?? '–'} g protein
            </Text>
            <Text style={type.secondary}>
              {h && a
                ? 'Change both any time in Settings.'
                : 'Calories update once you add height and age. Change both any time in Settings.'}
            </Text>
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Button label={`Start ${programName}`} onPress={start} loading={save.isPending} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 },
  centerText: { textAlign: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12, gap: 10 },
  steps: { flexDirection: 'row', gap: 6 },
  step: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 34, color: colors.ink },
  main: { paddingHorizontal: 20, gap: 12, paddingBottom: 12 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.card,
    padding: 16,
    gap: 10,
  },
  numbers: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  cardLabel: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  chipTextOn: { color: colors.white },
  days: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink2 },
  timeRow: { marginHorizontal: -16, marginBottom: -8 },
  targets: { backgroundColor: colors.accentSoft, borderRadius: radii.card, padding: 16, gap: 6 },
  targetsValue: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  error: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.danger },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
});
