import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Program, ProgressSummary } from '@/api/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ComingSoon } from '@/components/ComingSoon';
import { LineChart, LinePoint } from '@/components/LineChart';
import { ProteinBars } from '@/components/ProteinBars';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useProfile, useTimeZone } from '@/hooks/queries';
import { formatDayShort, todayIn, weekdayLabel } from '@/lib/dates';
import { weekDates, weekFor } from '@/lib/program';
import { useProgress } from '@/progress/data';
import { colors, fonts, radii, type } from '@/theme';

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export default function ProgressScreen() {
  const profile = useProfile();
  const program = profile.data?.program;
  if (!program) {
    return <ComingSoon title="Progress" body={profile.isPending ? 'Loading…' : 'No program is set up on your server yet.'} />;
  }
  return <ProgressBody program={program} />;
}

function ProgressBody({ program }: { program: Program }) {
  const tz = useTimeZone();
  const today = todayIn(tz);
  const lastWeek = program.weeks.length;
  const week = weekFor(program, today) ?? (today < program.start_date ? 1 : lastWeek);
  const progress = useProgress(week);
  const data = progress.data;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader
        eyebrow={`${program.name} · Week ${week} of ${lastWeek}`}
        title="Progress"
        right={
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/review', params: { week: String(week) } })}
            style={styles.pill}
          >
            <Text style={styles.pillText}>Weekly review</Text>
          </Pressable>
        }
      />
      <ScrollView
        contentContainerStyle={styles.main}
        refreshControl={<RefreshControl refreshing={progress.isRefetching} onRefresh={() => progress.refetch()} />}
      >
        {progress.isError && !data ? (
          <Card>
            <Text style={type.body}>{(progress.error as Error).message}</Text>
          </Card>
        ) : null}
        {data ? <Summary data={data} program={program} week={week} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Summary({ data, program, week }: { data: ProgressSummary; program: Program; week: number }) {
  const loggedDays = data.protein_by_day.filter((d) => d.protein_g !== null).length;
  const target = data.protein_target_g ?? 130;
  const weights: LinePoint[] = data.bodyweight
    .filter((p) => p.kg !== null)
    .map((p) => ({ label: `W${p.week}`, name: `Week ${p.week}`, value: p.kg! }));
  const forearms: LinePoint[] = data.forearm
    .filter((p) => p.cm !== null)
    .map((p) => ({ label: `W${p.week}`, name: `Week ${p.week}`, value: p.cm! }));
  const checkedInThisWeek = data.bodyweight.some((p) => p.week === week && p.kg !== null);
  const sunday = weekDates(program, week)[6];
  const nextSunday = weekDates(program, Math.min(week + 1, program.weeks.length))[6];
  const goToCheckin = () => router.push({ pathname: '/checkin', params: { week: String(week) } });

  return (
    <>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {data.sessions.done} <Text style={styles.statOf}>/ {data.sessions.planned_to_date}</Text>
          </Text>
          <Text style={type.secondary}>sessions logged so far</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>
            {data.protein_days_hit} <Text style={styles.statOf}>/ {loggedDays}</Text>
          </Text>
          <Text style={type.secondary}>days protein target hit</Text>
        </View>
      </View>

      <Card>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>Protein this week</Text>
          <Text style={styles.caption}>target {target} g</Text>
        </View>
        <ProteinBars
          target={target}
          days={data.protein_by_day.map((d) => ({ label: weekdayLabel(d.date).dow, protein: d.protein_g }))}
        />
      </Card>

      <Card style={styles.table}>
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, styles.flex]}>Lift</Text>
          <Text style={[styles.th, styles.start]}>Start</Text>
          <Text style={[styles.th, styles.best]}>Best set</Text>
        </View>
        {data.lifts.map((lift) => (
          <View
            key={lift.exercise}
            style={styles.tr}
            accessible
            accessibilityLabel={`${lift.label}: start ${lift.start_kg ?? 'not set'} kg, best ${
              lift.best ? `${lift.best.kg} kg for ${lift.best.amount}` : 'none yet'
            }`}
          >
            <Text style={[type.body, styles.flex]}>{lift.label}</Text>
            <Text style={[styles.mono, styles.start, styles.muted]}>{lift.start_kg !== null ? fmt(lift.start_kg) : '–'}</Text>
            <Text style={[styles.mono, styles.best]}>{lift.best ? `${fmt(lift.best.kg)} × ${fmt(lift.best.amount)}` : '–'}</Text>
          </View>
        ))}
      </Card>

      {weights.length >= 2 ? (
        <>
          <Card>
            <Text style={styles.cardTitle}>Body weight</Text>
            <LineChart points={weights} unit="kg" />
          </Card>
          <Card>
            <Text style={styles.cardTitle}>Forearm</Text>
            {forearms.length >= 2 ? (
              <LineChart points={forearms} unit="cm" />
            ) : (
              <Text style={type.secondary}>The forearm chart starts after two measurements.</Text>
            )}
          </Card>
          <Button
            variant="secondary"
            label={checkedInThisWeek ? "Edit this week's check-in" : 'Check in'}
            onPress={goToCheckin}
          />
        </>
      ) : (
        <View style={styles.next}>
          <View style={styles.flex}>
            <Text style={styles.nextTitle}>
              {weights.length === 0
                ? `First weigh-in: ${formatDayShort(sunday)}`
                : `Next weigh-in: ${formatDayShort(checkedInThisWeek ? nextSunday : sunday)}`}
            </Text>
            <Text style={type.secondary}>
              {weights.length === 0
                ? 'Body weight and forearm charts start once you log it.'
                : 'Charts start after your second check-in.'}
            </Text>
          </View>
          <Pressable accessibilityRole="button" onPress={goToCheckin} style={styles.checkin}>
            <Text style={styles.checkinText}>Check in</Text>
          </Pressable>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  pill: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.ink },
  main: { paddingHorizontal: 20, paddingBottom: 24, gap: 12 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  statValue: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, color: colors.ink },
  statOf: { fontSize: 18, color: colors.ink3 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  caption: { fontFamily: fonts.body, fontSize: 12, color: colors.ink3 },
  table: { paddingVertical: 8, gap: 0 },
  tr: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderBottomWidth: 1, borderBottomColor: colors.track },
  thead: { minHeight: 32 },
  th: { ...type.eyebrow, fontSize: 11 },
  flex: { flex: 1 },
  start: { width: 64, textAlign: 'right' },
  best: { width: 84, textAlign: 'right' },
  mono: { fontFamily: fonts.mono, fontSize: 14, color: colors.ink },
  muted: { color: colors.ink2 },
  next: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  nextTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  checkin: { height: 44, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.accent, justifyContent: 'center' },
  checkinText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.white },
});
