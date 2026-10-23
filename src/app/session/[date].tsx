import { router, useLocalSearchParams } from 'expo-router';
import { Check, Clock } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Routine, Session } from '@/api/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { CallChip } from '@/components/CallChip';
import { Card } from '@/components/Card';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatTile } from '@/components/StatTile';
import { TimePickerRow } from '@/components/TimePickerRow';
import { useProfile, useTimeZone } from '@/hooks/queries';
import { addDays, formatDayShort, hhmmIn, isoAt } from '@/lib/dates';
import { callLabel, chipKind } from '@/lib/nextCall';
import { routineFor } from '@/lib/program';
import { formatKcal } from '@/lib/targets';
import { shortExerciseName } from '@/lib/today';
import { colors, fonts, MIN_TAP, radii, type } from '@/theme';
import { saveSessionTimes, useLocalWorkouts, useServerHistories, useSessionForDate } from '@/workout/data';
import { callFor, effortRead, exerciseInfo, historyFor, nextItemFor, summarise } from '@/workout/model';

export default function SessionSummaryScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const session = useSessionForDate(date);

  if (session.isPending) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }
  if (!session.data) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScreenHeader title={formatDayShort(date)} onBack />
        <View style={styles.main}>
          <Card>
            <Text style={type.body}>No session was logged on this day.</Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }
  return <Summary session={session.data} />;
}

function Summary({ session }: { session: Session }) {
  const tz = useTimeZone();
  const [timesOpen, setTimesOpen] = useState(false);
  const profile = useProfile().data;
  const program = profile?.program ?? null;
  const library = profile?.exercises;
  const exercises = [...new Set(session.sets.map((s) => s.exercise))];
  const local = useLocalWorkouts();
  const server = useServerHistories(exercises);
  const summary = summarise(session, library);
  const read = effortRead(summary.effort);
  const rated = summary.effort.easy + summary.effort.right + summary.effort.hard;

  // "Next time": the rule applied with this session as the latest history.
  const nextDay = addDays(session.session_date, 1);
  const calls = program
    ? exercises.flatMap((exercise) => {
        const item = nextItemFor(program, exercise, nextDay);
        if (!item) return [];
        const history = historyFor(exercise, nextDay, [session, ...(local.data?.sessions ?? [])], server.byExercise[exercise] ?? []);
        const call = callFor({ program, item, info: exerciseInfo(library, exercise), history });
        return [{ exercise, call }];
      })
    : [];

  const done = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.main}>
        <View style={styles.header}>
          <View style={styles.tick}>
            <Check size={26} strokeWidth={2} color={colors.white} />
          </View>
          <Text style={type.eyebrow}>{formatDayShort(session.session_date)} · saved</Text>
          <Text accessibilityRole="header" style={type.screenTitle}>
            {session.routine_name ?? 'Workout'} done
          </Text>
        </View>

        <View style={styles.tiles}>
          <StatTile value={summary.durationMin !== null ? `${summary.durationMin} min` : '–'} caption="duration" />
          <StatTile value={String(summary.setsLogged)} caption="sets logged" />
          <StatTile value={`${formatKcal(summary.totalKg)} kg`} caption="total lifted" />
        </View>
        <Pressable accessibilityRole="button" onPress={() => setTimesOpen(true)} style={styles.editTimes}>
          <Clock size={16} strokeWidth={2} color={colors.accent} />
          <Text style={styles.editTimesText}>Edit times</Text>
        </Pressable>

        <Card style={styles.gap10}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>How hard it felt</Text>
            <Text style={type.secondary}>{summary.setsLogged} sets</Text>
          </View>
          {rated ? (
            <>
              <View style={styles.bar} accessible accessibilityLabel={`${summary.effort.easy} easy, ${summary.effort.right} right, ${summary.effort.hard} hard`}>
                {summary.effort.easy ? <View style={{ flex: summary.effort.easy, backgroundColor: colors.up }} /> : null}
                {summary.effort.right ? <View style={{ flex: summary.effort.right, backgroundColor: colors.accent }} /> : null}
                {summary.effort.hard ? <View style={{ flex: summary.effort.hard, backgroundColor: colors.hold }} /> : null}
              </View>
              <View style={styles.counts}>
                <Text style={type.secondary}>
                  <Text style={[styles.count, { color: colors.up }]}>{summary.effort.easy}</Text> easy
                </Text>
                <Text style={type.secondary}>
                  <Text style={[styles.count, { color: colors.accent }]}>{summary.effort.right}</Text> right
                </Text>
                <Text style={type.secondary}>
                  <Text style={[styles.count, { color: colors.hold }]}>{summary.effort.hard}</Text> hard
                </Text>
              </View>
            </>
          ) : null}
          <Text style={[styles.read, read.tone === 'up' ? styles.readUp : read.tone === 'hold' ? styles.readHold : styles.readAccent]}>
            {read.text}
          </Text>
        </Card>

        {calls.length ? (
          <Card style={styles.nextCard}>
            <Text style={[type.eyebrow, styles.nextTitle]}>Next time</Text>
            {calls.map(({ exercise, call }) => (
              <View key={exercise} style={styles.nextRow}>
                <View style={styles.flex}>
                  <Text style={type.bodyMedium}>{shortExerciseName(exercise)}</Text>
                  <Text style={[type.secondary, styles.small]}>{call.reason}</Text>
                </View>
                <CallChip kind={chipKind(call.call)} label={callLabel(call)} />
              </View>
            ))}
          </Card>
        ) : null}

        {session.note ? (
          <Card style={styles.gap4}>
            <Text style={type.eyebrow}>Your note</Text>
            <Text style={type.body}>{session.note}</Text>
          </Card>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Button
          variant="secondary"
          label="Edit workout"
          onPress={() => router.replace({ pathname: '/workout', params: { date: session.session_date } })}
          style={styles.flex}
        />
        <Button label="Done" onPress={done} style={styles.flex} />
      </View>
      {timesOpen ? (
        <TimesSheet
          session={session}
          timeZone={tz}
          routine={program ? routineFor(program, session.session_date) : null}
          onClose={() => setTimesOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

/** Fix a session's start and finish times, on the session's day. */
function TimesSheet({
  session,
  timeZone,
  routine,
  onClose,
}: {
  session: Session;
  timeZone: string;
  routine: Routine | null;
  onClose: () => void;
}) {
  const fallback = session.finished_at ?? session.client_updated_at ?? new Date().toISOString();
  const [start, setStart] = useState(hhmmIn(session.started_at ?? fallback, timeZone));
  const [end, setEnd] = useState(hhmmIn(session.finished_at ?? fallback, timeZone));
  const [saving, setSaving] = useState(false);
  const day = session.session_date;
  const startIso = isoAt(day, start, timeZone);
  const endIso = isoAt(day, end, timeZone);
  const valid = Date.parse(endIso) > Date.parse(startIso);

  async function save() {
    setSaving(true);
    try {
      await saveSessionTimes(day, { started_at: startIso, finished_at: endIso }, routine);
      onClose();
    } catch (e) {
      Alert.alert("Couldn't save the times", (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible title="Edit times" onClose={onClose}>
      <View style={styles.sheetBody}>
        <Text style={type.secondary}>Times on {formatDayShort(day)}. The duration is worked out from these.</Text>
        <View>
          <TimePickerRow first label="Started" value={start} onChange={setStart} />
          <TimePickerRow label="Finished" value={end} onChange={setEnd} />
        </View>
        {valid ? null : <Text style={styles.error}>Finish must be after start.</Text>}
        <Button label="Save times" onPress={save} disabled={!valid} loading={saving} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  main: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  header: { paddingTop: 28, paddingBottom: 2, gap: 6, alignItems: 'flex-start' },
  tick: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.up, alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: 10 },
  cardTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  bar: { flexDirection: 'row', height: 14, borderRadius: 7, overflow: 'hidden', gap: 2 },
  counts: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  count: { fontFamily: fonts.bodySemi },
  read: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.ink, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, overflow: 'hidden' },
  readUp: { backgroundColor: colors.upSoft },
  readHold: { backgroundColor: colors.holdSoft },
  readAccent: { backgroundColor: colors.accentSoft },
  nextCard: { paddingVertical: 8, gap: 0 },
  nextTitle: { paddingTop: 8, paddingBottom: 4 },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.track },
  flex: { flex: 1 },
  small: { fontSize: 12, lineHeight: 16 },
  gap10: { gap: 10 },
  gap4: { gap: 4, borderRadius: radii.button },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  editTimes: { alignSelf: 'flex-start', minHeight: MIN_TAP, flexDirection: 'row', alignItems: 'center', gap: 6 },
  editTimesText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.accent },
  sheetBody: { gap: 12 },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.hold },
});
