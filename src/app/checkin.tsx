import { router, useLocalSearchParams } from 'expo-router';
import { Camera, ImageIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetworkError } from '@/api/client';
import * as api from '@/api/endpoints';
import type { CheckinGetResponse, CheckinPayload, Program } from '@/api/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { RatingRow } from '@/components/RatingRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TextField } from '@/components/TextField';
import { takePhoto, Photo } from '@/food/photo';
import { useProfile, useTimeZone } from '@/hooks/queries';
import { checkinDate, MEASURE_RULES, nextPhotoWeek, photoDue, stepWeight } from '@/lib/checkin';
import { formatDayShort, todayIn } from '@/lib/dates';
import { checkRange, formatNumber, parseNumber } from '@/lib/numbers';
import { weekDates, weekFor } from '@/lib/program';
import { useCheckin } from '@/progress/data';
import { useAuth } from '@/state/auth';
import { useNotice } from '@/state/notice';
import { queryClient } from '@/state/queryClient';
import { enqueueAndSync } from '@/sync';
import { colors, fonts, radii, type } from '@/theme';

export default function CheckinScreen() {
  const params = useLocalSearchParams<{ week?: string }>();
  const tz = useTimeZone();
  const today = todayIn(tz);
  const profile = useProfile().data;
  const program = profile?.program ?? null;
  const lastWeek = program?.weeks.length ?? 12;
  const week = Number(params.week) || (program ? (weekFor(program, today) ?? (today < program.start_date ? 1 : lastWeek)) : 1);
  const checkin = useCheckin(week);

  if (!program || !checkin.data) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        {checkin.isError ? (
          <Text style={type.body}>{(checkin.error as Error).message}</Text>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </SafeAreaView>
    );
  }
  return (
    <CheckinForm
      key={week}
      week={week}
      data={checkin.data}
      program={program}
      today={today}
      fallbackWeight={profile?.weight_kg ?? null}
    />
  );
}

function CheckinForm({
  week,
  data,
  program,
  today,
  fallbackWeight,
}: {
  week: number;
  data: CheckinGetResponse;
  program: Program;
  today: string;
  fallbackWeight: number | null;
}) {
  const credentials = useAuth((s) => s.credentials);
  const showNotice = useNotice((s) => s.show);
  const existing = data.checkin;
  const dates = weekDates(program, week);
  const date = existing?.checkin_date ?? checkinDate(dates, today);
  const startWeight = existing?.weight_kg ?? data.previous_weight_kg ?? fallbackWeight ?? 72;

  const [weight, setWeight] = useState(startWeight.toFixed(1));
  const [waist, setWaist] = useState(formatNumber(existing?.waist_cm));
  const [forearm, setForearm] = useState(formatNumber(existing?.forearm_cm));
  const [sleep, setSleep] = useState<number | null>(existing?.sleep ?? null);
  const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const w = parseNumber(weight);
  const wa = parseNumber(waist);
  const fa = parseNumber(forearm);
  const errors = {
    weight: checkRange(w, MEASURE_RULES.weight),
    waist: checkRange(wa, MEASURE_RULES.waist),
    forearm: checkRange(fa, MEASURE_RULES.forearm),
  };
  const due = data.due.waist || data.due.forearm;
  const photoWeek = photoDue(week);
  const nextPhoto = nextPhotoWeek(week + 1, program.weeks.length);

  async function pick(source: 'camera' | 'library') {
    try {
      const taken = await takePhoto(source);
      if (taken) setPhoto(taken);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save() {
    setTouched(true);
    if (errors.weight || errors.waist || errors.forearm || !credentials) return;
    const payload: CheckinPayload = { week, checkin_date: date, weight_kg: w!, waist_cm: wa, forearm_cm: fa, sleep, energy };
    setSaving(true);
    setError(null);
    try {
      const saved = await api.saveCheckin(credentials, payload);
      if (photo) {
        const url = await api.uploadPrivateFile(
          credentials,
          { uri: photo.uri, name: `progress-week-${week}.jpg`, type: photo.mime },
          { doctype: 'LL Check In', docname: saved.name },
        );
        await api.setCheckinPhoto(credentials, week, url);
      }
    } catch (e) {
      if (!(e instanceof NetworkError)) {
        setError((e as Error).message);
        setSaving(false);
        return;
      }
      await enqueueAndSync('checkin', String(week), payload);
      showNotice(
        photo
          ? "Check-in saved on this phone. The photo needs a connection; add it again when you're online."
          : 'Check-in saved on this phone. It will sync when you are back online.',
      );
    }
    for (const key of [['profile'], ['progress'], ['checkin', week], ['today']]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
    router.replace({ pathname: '/review', params: { week: String(week) } });
  }

  const existingPhoto =
    existing?.photo && credentials
      ? {
          uri: `${credentials.server}${existing.photo}`,
          headers: { Authorization: `token ${credentials.apiKey}:${credentials.apiSecret}` },
        }
      : null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <ScreenHeader eyebrow={`${formatDayShort(date)} · Week ${week}`} title="Sunday check-in" onBack />
        <ScrollView contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled">
          <Card style={styles.weightCard}>
            <Text style={type.eyebrow}>Body weight</Text>
            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease by 0.1 kg"
                onPress={() => setWeight(stepWeight(w ?? startWeight, -0.1).toFixed(1))}
                style={styles.round}
              >
                <Text style={styles.sign}>−</Text>
              </Pressable>
              <View style={styles.weightValue}>
                <TextInput
                  accessibilityLabel="Body weight in kg"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  style={styles.weightInput}
                />
                <Text style={styles.kg}>kg</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase by 0.1 kg"
                onPress={() => setWeight(stepWeight(w ?? startWeight, 0.1).toFixed(1))}
                style={styles.round}
              >
                <Text style={styles.sign}>+</Text>
              </Pressable>
            </View>
            {touched && errors.weight ? <Text style={styles.error}>{errors.weight}</Text> : null}
            <Text style={[type.secondary, styles.centered]}>Weigh in the morning, before eating, same scale each week.</Text>
          </Card>

          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Measurements</Text>
              {due ? <Text style={styles.due}>Due this week</Text> : null}
            </View>
            <View style={styles.pair}>
              <TextField
                label="Waist (cm)"
                variant="numeric"
                value={waist}
                onChangeText={setWaist}
                placeholder="at the navel"
                keyboardType="decimal-pad"
                error={touched ? errors.waist : null}
              />
              <TextField
                label="Forearm (cm)"
                variant="numeric"
                value={forearm}
                onChangeText={setForearm}
                placeholder="widest point"
                keyboardType="decimal-pad"
                error={touched ? errors.forearm : null}
              />
            </View>
            <Text style={styles.note}>Every 2 weeks. Same arm each time.</Text>
          </Card>

          <Card>
            <Text style={styles.cardTitle}>How was the week?</Text>
            <View style={styles.scale}>
              <Text style={type.secondary}>Sleep</Text>
              <RatingRow label="Sleep" value={sleep} onChange={setSleep} />
            </View>
            <View style={styles.scale}>
              <Text style={type.secondary}>Energy in the gym</Text>
              <RatingRow label="Energy in the gym" value={energy} onChange={setEnergy} />
            </View>
            <Text style={styles.note}>1 = poor, 5 = great. Used in your weekly review.</Text>
          </Card>

          {photoWeek || existingPhoto || photo ? (
            <Card>
              <Text style={styles.cardTitle}>Progress photo</Text>
              {photo || existingPhoto ? (
                <Image
                  source={photo ? { uri: photo.uri } : existingPhoto!}
                  style={styles.photo}
                  accessibilityLabel="Progress photo"
                />
              ) : null}
              <Text style={type.secondary}>Optional. Stored privately on your server.</Text>
              <View style={styles.pair}>
                <Button
                  variant="secondary"
                  label={photo || existingPhoto ? 'Retake' : 'Take photo'}
                  icon={<Camera size={18} strokeWidth={2} color={colors.ink} />}
                  height={44}
                  onPress={() => pick('camera')}
                  style={styles.flex}
                />
                <Button
                  variant="secondary"
                  label="Library"
                  icon={<ImageIcon size={18} strokeWidth={2} color={colors.ink} />}
                  height={44}
                  onPress={() => pick('library')}
                  style={styles.flex}
                />
              </View>
            </Card>
          ) : nextPhoto ? (
            <View style={styles.photoRow}>
              <View style={styles.photoIcon}>
                <Camera size={20} strokeWidth={2} color={colors.ink3} />
              </View>
              <Text style={[type.secondary, styles.flex]}>
                Progress photo next due {formatDayShort(weekDates(program, nextPhoto)[6])}.
              </Text>
            </View>
          ) : null}

          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Save and see weekly review" onPress={save} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: 20 },
  main: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12, gap: 12 },
  weightCard: { alignItems: 'center', gap: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  round: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sign: { fontFamily: fonts.body, fontSize: 24, color: colors.ink },
  weightValue: { flexDirection: 'row', alignItems: 'baseline', minWidth: 150, justifyContent: 'center' },
  weightInput: { fontFamily: fonts.display, fontSize: 60, color: colors.ink, padding: 0, textAlign: 'center', minWidth: 100 },
  kg: { fontFamily: fonts.display, fontSize: 22, color: colors.ink3 },
  centered: { textAlign: 'center' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  due: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.hold,
    backgroundColor: colors.holdSoft,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.chip,
    overflow: 'hidden',
  },
  pair: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.ink3 },
  scale: { gap: 6 },
  photo: { width: '100%', height: 220, borderRadius: radii.inner, backgroundColor: colors.track },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 2 },
  photoIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  error: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.danger },
  footer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
});
