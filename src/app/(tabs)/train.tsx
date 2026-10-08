import { router } from 'expo-router';
import { CalendarDays } from 'lucide-react-native';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Program } from '@/api/types';
import { Card } from '@/components/Card';
import { ComingSoon } from '@/components/ComingSoon';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useProfile, useTimeZone } from '@/hooks/queries';
import { formatDayMonth, formatDayShort, todayIn, weekdayLabel } from '@/lib/dates';
import { mainReps, phaseSpans, routineFor, weekDates, weekFor } from '@/lib/program';
import { movedFrom } from '@/lib/review';
import { usePlanChanges } from '@/review/data';
import { colors, fonts, phaseColors, radii, type } from '@/theme';
import { useLocalWorkouts, useSessionsMonth } from '@/workout/data';
import { dayStatus, DayStatus } from '@/workout/model';
import { restDaysLine, sessionsByDate, WeekRow, weekRows } from '@/workout/week';

export default function TrainScreen() {
  const profile = useProfile();
  const program = profile.data?.program;
  if (!program) {
    return <ComingSoon title="Train" body={profile.isPending ? 'Loading…' : 'No program is set up on your server yet.'} />;
  }
  return <TrainBody program={program} sessionTime={profile.data?.session_time ?? '18:00'} />;
}

function TrainBody({ program, sessionTime }: { program: Program; sessionTime: string }) {
  const tz = useTimeZone();
  const today = todayIn(tz);
  const lastWeek = program.weeks.length;
  const week = weekFor(program, today) ?? (today < program.start_date ? 1 : lastWeek);
  const dates = weekDates(program, week);
  const months = [...new Set([dates[0].slice(0, 7), dates[6].slice(0, 7)])];
  const first = useSessionsMonth(months[0]);
  const second = useSessionsMonth(months[1] ?? months[0]);
  const local = useLocalWorkouts();
  const server = [...(first.data ?? []), ...(months[1] ? (second.data ?? []) : [])];
  const sessions = sessionsByDate(server, local.data?.drafts ?? []);
  const rows: (WeekRow & { from?: string })[] = weekRows(program, dates, today, sessions, sessionTime);
  // An accepted "move a missed Monday to Saturday" adds that routine on Saturday.
  const plan = usePlanChanges(week);
  const saturday = dates[5];
  const from = movedFrom(program, saturday, plan.data, (d) => !!sessions.get(d));
  if (from && !rows.some((r) => r.date === saturday)) {
    const moved = routineFor(program, from)!;
    const status = dayStatus(program, saturday, today, sessions.get(saturday) ?? null);
    rows.push({
      date: saturday,
      routine: moved,
      status: status === 'rest' ? (saturday < today ? 'missed' : saturday === today ? 'today' : 'upcoming') : status,
      detail: `Moved from ${formatDayShort(from)}`,
      from,
    });
  }

  const refresh = () => {
    void first.refetch();
    void second.refetch();
    void local.refetch();
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        eyebrow={`${program.name} · ${formatDayMonth(program.start_date)} – ${formatDayMonth(program.end_date)}`}
        title="Train"
        right={
          <Pressable accessibilityRole="button" onPress={() => router.push('/history')} style={styles.history}>
            <CalendarDays size={18} strokeWidth={2} color={colors.ink} />
            <Text style={styles.historyText}>History</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={styles.main}
        refreshControl={<RefreshControl refreshing={first.isRefetching} onRefresh={refresh} />}
      >
        <BlockCard program={program} week={week} />

        <View style={styles.section}>
          <Text style={[type.eyebrow, styles.pad]}>This week</Text>
          {rows.map((row) => {
            const { dow, num } = weekdayLabel(row.date);
            const chip = CHIPS[row.status];
            const isToday = row.status === 'today';
            const label = row.status === 'upcoming' ? dow.charAt(0) + dow.slice(1).toLowerCase() : chip.label;
            return (
              <Pressable
                key={row.date}
                accessibilityRole="button"
                accessibilityLabel={`${dow} ${num}, ${row.routine.name}, ${label}`}
                onPress={() =>
                  row.status === 'done'
                    ? router.push({ pathname: '/session/[date]', params: { date: row.date } })
                    : router.push({
                        pathname: '/workout',
                        params: row.from ? { date: row.date, from: row.from } : { date: row.date },
                      })
                }
                style={[styles.day, isToday && styles.dayToday]}
              >
                <View style={styles.dayDate}>
                  <Text style={styles.dow}>{dow}</Text>
                  <Text style={styles.num}>{num}</Text>
                </View>
                <View style={styles.dayText}>
                  <Text style={styles.dayName}>{row.routine.name}</Text>
                  {row.detail ? <Text style={type.secondary}>{row.detail}</Text> : null}
                </View>
                <Text style={[styles.chip, { backgroundColor: chip.bg, color: chip.fg }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[type.secondary, styles.pad]}>{restDaysLine(program, dates)}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const CHIPS: Record<DayStatus, { label: string; bg: string; fg: string }> = {
  missed: { label: 'Missed', bg: colors.holdSoft, fg: colors.hold },
  done: { label: 'Done', bg: colors.upSoft, fg: colors.up },
  in_progress: { label: 'Resume', bg: colors.accent, fg: colors.white },
  today: { label: 'Start', bg: colors.accent, fg: colors.white },
  upcoming: { label: '', bg: colors.surface2, fg: colors.ink2 },
  rest: { label: 'Rest', bg: colors.surface2, fg: colors.ink2 },
};

function BlockCard({ program, week }: { program: Program; week: number }) {
  const spans = phaseSpans(program);
  const reps = mainReps(program, week);
  const current = program.weeks.find((w) => w.week === week);
  const next = program.phases.find((p) => p.weeks[0] > week);
  const blurb = [
    reps ? `Main lifts at ${reps.replace('-', '–')} reps this phase.` : null,
    next ? `${next.name} from week ${next.weeks[0]}.` : 'Last phase of the block.',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <Card style={styles.block}>
      <View style={styles.rowBetween}>
        <Text style={styles.blockTitle}>{program.weeks.length}-week block</Text>
        <Text style={type.secondary}>Week {week}</Text>
      </View>
      <View style={styles.bars} accessible accessibilityLabel={`Week ${week} of ${program.weeks.length}, ${current?.phase ?? ''} phase`}>
        {program.weeks.map((w) => (
          <View
            key={w.week}
            style={[
              styles.bar,
              { backgroundColor: phaseColors[w.phase] ?? colors.accent },
              w.week === week ? styles.barCurrent : styles.barOther,
            ]}
          />
        ))}
      </View>
      <View style={styles.phaseRow}>
        {spans.map((p) => (
          <Text key={p.key} style={[styles.phaseLabel, { flex: p.weeks }]} numberOfLines={1}>
            {PHASE_SHORT[p.key] ?? p.name}
          </Text>
        ))}
      </View>
      <Text style={type.secondary}>{blurb}</Text>
    </Card>
  );
}

const PHASE_SHORT: Record<string, string> = { build: 'Build', deload: 'Home', strength: 'Strength', peak: 'Peak', test: 'Test' };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  history: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  main: { paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
  block: { padding: 16, gap: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  blockTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  bars: { flexDirection: 'row', gap: 3, alignItems: 'flex-end', height: 18 },
  bar: { flex: 1, borderRadius: 3 },
  barCurrent: { height: 18 },
  barOther: { height: 10, opacity: 0.45 },
  phaseRow: { flexDirection: 'row', gap: 3 },
  phaseLabel: { fontFamily: fonts.bodySemi, fontSize: 11, color: colors.ink2 },
  section: { gap: 8 },
  pad: { paddingHorizontal: 2 },
  day: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 12,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  dayToday: { borderWidth: 2, borderColor: colors.accent },
  dayDate: { width: 48, alignItems: 'center' },
  dow: { fontFamily: fonts.bodySemi, fontSize: 11, letterSpacing: 0.66, color: colors.ink3 },
  num: { fontFamily: fonts.displaySemi, fontSize: 22, lineHeight: 24, color: colors.ink },
  dayText: { flex: 1, gap: 2, minWidth: 0 },
  dayName: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  chip: {
    fontFamily: fonts.bodySemi,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.chip,
    overflow: 'hidden',
  },
});
