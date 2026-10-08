import { router } from 'expo-router';
import { Play, Settings, TrendingUp, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Session, TodayResponse } from '@/api/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Meter } from '@/components/Meter';
import { ScreenHeader } from '@/components/ScreenHeader';
import { WeekStrip } from '@/components/WeekStrip';
import { useProfile, useSaveProfile, useTimeZone, useToday } from '@/hooks/queries';
import { useFoodDay } from '@/food/data';
import { totals } from '@/food/model';
import { addDays, formatDayShort, formatTime12, minutesNowIn, todayIn } from '@/lib/dates';
import { callSentence } from '@/lib/nextCall';
import {
  describeSets,
  phaseLabel,
  proteinBehindPace,
  proteinHint,
  routineChips,
  sessionCard,
  sessionEyebrow,
} from '@/lib/today';
import { useAuth } from '@/state/auth';
import { colors, fonts, type } from '@/theme';
import { useLocalWorkouts, useServerHistories } from '@/workout/data';
import { routineFor } from '@/lib/program';
import { movedFrom } from '@/lib/review';
import { usePlanChanges } from '@/review/data';
import { callFor, exerciseInfo, historyFor, nextItemFor, toSession } from '@/workout/model';

export default function TodayScreen() {
  const today = useToday();
  const profile = useProfile();
  const tz = useTimeZone();
  const setHasProfile = useAuth((s) => s.setHasProfile);

  // The profile was removed on the server: go back through setup.
  useEffect(() => {
    if (profile.data && !profile.data.exists) void setHasProfile(false);
  }, [profile.data, setHasProfile]);

  // This phone's copy of today's workout is newer than the server's until it syncs.
  const local = useLocalWorkouts();
  const foodDay = useFoodDay(todayIn(tz));
  const server = today.data;
  const draft = server ? local.data?.drafts.find((d) => d.date === server.date) : undefined;
  let data = server && draft ? { ...server, session: toSession(draft) } : server;
  // Same for food logged offline.
  if (data && foodDay.pending && foodDay.day.food_date === data.date) data = { ...data, food: totals(foodDay.day.entries) };
  // An accepted "move a missed Monday to Saturday" puts that routine on today's card.
  const plan = usePlanChanges(data?.week ?? null);
  const program = profile.data?.program;
  const trained = (date: string) => !!data?.week_strip.find((d) => d.date === date)?.trained;
  const from = data && program && !data.routine?.items?.length ? movedFrom(program, data.date, plan.data, trained) : null;
  if (data && program && from) data = { ...data, routine: routineFor(program, from) };
  const phase = phaseLabel(data?.phase);
  const eyebrow = data ? `${formatDayShort(data.date)}${data.week ? ` · Week ${data.week}` : ''}` : ' ';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        eyebrow={eyebrow}
        title="Today"
        right={
          <>
            {phase ? <Text style={styles.phase}>{phase}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Settings"
              onPress={() => router.push('/settings')}
              style={styles.gear}
            >
              <Settings size={22} strokeWidth={2} color={colors.ink} />
            </Pressable>
          </>
        }
      />
      {data ? <WeekStrip days={data.week_strip} selected={data.date} /> : null}

      <ScrollView
        contentContainerStyle={styles.main}
        refreshControl={<RefreshControl refreshing={today.isRefetching} onRefresh={() => today.refetch()} />}
      >
        {today.isError && !data ? (
          <Card>
            <Text style={type.body}>{(today.error as Error).message}</Text>
            <Button variant="secondary" label="Try again" onPress={() => today.refetch()} />
          </Card>
        ) : null}
        {data ? (
          <>
            <TargetsNote note={data.targets_note} />
            <SessionCardView data={data} sessionTime={profile.data?.session_time ?? null} from={from} />
            <FoodCard data={data} minutesNow={minutesNowIn(tz)} />
            <LastSessionCard data={data} sessions={local.data?.sessions ?? []} />
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The one-time "Targets updated" note: shown, then cleared on the server so it never repeats. */
function TargetsNote({ note }: { note: string | null }) {
  const [shown, setShown] = useState<string | null>(null);
  const cleared = useRef(false);
  const save = useSaveProfile();
  useEffect(() => {
    if (note && !cleared.current) {
      cleared.current = true;
      setShown(note);
      save.mutate({ targets_note: '' });
    }
  }, [note, save]);
  if (!shown) return null;
  return (
    <View style={styles.note} accessibilityRole="alert">
      <Text style={[type.body, styles.noteText]}>{shown}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={() => setShown(null)} style={styles.dismiss}>
        <X size={20} strokeWidth={2} color={colors.accent} />
      </Pressable>
    </View>
  );
}

function SessionCardView({ data, sessionTime, from }: { data: TodayResponse; sessionTime: string | null; from: string | null }) {
  const card = sessionCard(data.routine, data.session);
  if (card.kind === 'rest' || card.kind === 'checkin') {
    return (
      <Card>
        <Text style={styles.cardTitle}>{card.kind === 'rest' ? 'Rest day' : 'Check-in day'}</Text>
        <Text style={styles.paragraph}>
          {card.kind === 'rest' ? 'No session today. Keep the food on track.' : 'Weigh in, then review your week.'}
        </Text>
        {card.kind === 'checkin' ? <Button label="Check in" onPress={() => router.push('/checkin')} /> : null}
      </Card>
    );
  }
  const { routine } = card;
  const time = sessionTime ?? '18:00';
  return (
    <Card>
      <Text style={type.eyebrow}>
        {card.kind === 'done' ? 'Done' : sessionEyebrow(time, formatTime12(time))}
      </Text>
      <Text style={styles.cardTitle}>{routine.name}</Text>
      {from ? <Text style={styles.paragraph}>Moved from {formatDayShort(from)} by your weekly review.</Text> : null}
      {routine.note ? <Text style={styles.paragraph}>{routine.note}</Text> : null}
      {card.kind !== 'optional' ? (
        <View style={styles.chips}>
          {(card.kind === 'done' ? [`${card.setsLogged} sets logged`] : routineChips(routine)).map((chip) => (
            <Text key={chip} style={styles.chip}>
              {chip}
            </Text>
          ))}
        </View>
      ) : null}
      {card.kind === 'start' || card.kind === 'resume' ? (
        <Button
          label={card.kind === 'start' ? 'Start workout' : 'Resume workout'}
          icon={<Play size={20} strokeWidth={2} color={colors.white} />}
          onPress={() => router.push({ pathname: '/workout', params: from ? { date: data.date, from } : { date: data.date } })}
        />
      ) : null}
      {card.kind === 'done' ? (
        <Button
          variant="secondary"
          label="View summary"
          onPress={() => router.push({ pathname: '/session/[date]', params: { date: data.date } })}
        />
      ) : null}
    </Card>
  );
}

function FoodCard({ data, minutesNow }: { data: TodayResponse; minutesNow: number }) {
  const { kcal, protein_g } = data.food;
  const target = data.targets.protein_g;
  const trainingToday = !!data.routine?.items?.length;
  const behind = proteinBehindPace(protein_g, target, minutesNow);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Food so far. Opens the Food tab."
      onPress={() => router.navigate('/food')}
      style={({ pressed }) => [styles.foodCard, pressed && styles.pressed]}
    >
      <View style={styles.foodHeader}>
        <Text style={type.eyebrow}>Food so far</Text>
        <Text style={styles.link}>Log food ›</Text>
      </View>
      <View style={styles.meters}>
        <Meter variant="calories" value={kcal} target={data.targets.kcal} />
        <Meter variant="protein" value={protein_g} target={target} />
      </View>
      {behind && target ? (
        <Text style={styles.hint}>{proteinHint(protein_g, target, minutesNow, trainingToday)}</Text>
      ) : null}
    </Pressable>
  );
}

function LastSessionCard({ data, sessions }: { data: TodayResponse; sessions: Session[] }) {
  const last = data.last_session;
  const profile = useProfile().data;
  const exercise = last?.highlight?.exercise;
  const server = useServerHistories(exercise ? [exercise] : []);
  if (!last) return null;

  // The add-weight call for the next time this lift comes up.
  let next = '';
  const program = profile?.program;
  if (exercise && program) {
    const item = nextItemFor(program, exercise, addDays(data.date, 1));
    if (item) {
      const history = historyFor(exercise, addDays(data.date, 1), sessions, server.byExercise[exercise] ?? []);
      next = ` ${callSentence(callFor({ program, item, info: exerciseInfo(profile.exercises, exercise), history }))}.`;
    }
  }
  return (
    <View style={styles.lastCard}>
      <View style={styles.lastIcon}>
        <TrendingUp size={22} strokeWidth={2} color={colors.accent} />
      </View>
      <View style={styles.lastText}>
        <Text style={styles.lastTitle}>Last session: {last.routine_name ?? formatDayShort(last.date)}</Text>
        {last.highlight ? (
          <Text style={type.secondary}>
            {describeSets(last.highlight.exercise, last.highlight.sets)}.{next}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  phase: {
    fontFamily: fonts.displaySemi,
    fontSize: 16,
    letterSpacing: 0.5,
    color: colors.accent,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  gear: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  main: { padding: 20, paddingTop: 16, gap: 14 },
  cardTitle: type.cardTitle,
  paragraph: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    color: colors.ink2,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  foodCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  pressed: { opacity: 0.9 },
  foodHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  link: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.accent },
  meters: { flexDirection: 'row', gap: 16 },
  hint: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.hold,
    backgroundColor: colors.holdSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    overflow: 'hidden',
  },
  lastCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  lastIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastText: { flex: 1, gap: 2 },
  lastTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  note: {
    backgroundColor: colors.accentSoft,
    borderRadius: 16,
    paddingLeft: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  noteText: { flex: 1, paddingVertical: 12 },
  dismiss: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
