import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, Dumbbell, Utensils } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/Card';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useProfile, useTimeZone } from '@/hooks/queries';
import { addDays, formatDayShort, parseDay, todayIn } from '@/lib/dates';
import { isMissed, routineFor } from '@/lib/program';
import { formatKcal } from '@/lib/targets';
import { describeSets } from '@/lib/today';
import { colors, fonts, radii, type } from '@/theme';
import { useFoodMonth, useLocalWorkouts, useSessionsMonth } from '@/workout/data';
import { sessionsByDate } from '@/workout/week';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}

/** Calendar cells for a month, Monday first, with leading blanks. */
function monthCells(month: string): (string | null)[] {
  const first = `${month}-01`;
  const lead = (parseDay(first).getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = first; day.startsWith(month); day = addDays(day, 1)) cells.push(day);
  return cells;
}

export default function HistoryScreen() {
  const tz = useTimeZone();
  const today = todayIn(tz);
  const program = useProfile().data?.program ?? null;
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const sessionsMonth = useSessionsMonth(month);
  const foodMonth = useFoodMonth(month);
  const local = useLocalWorkouts();

  const sessions = sessionsByDate(sessionsMonth.data ?? [], (local.data?.drafts ?? []).filter((d) => d.date.startsWith(month)));
  const food = new Map((foodMonth.data ?? []).map((f) => [f.date, f]));
  const [y, m] = month.split('-').map(Number);

  const session = sessions.get(selected) ?? null;
  const dayFood = food.get(selected);
  const routine = program ? routineFor(program, selected) : null;
  const missed = isMissed(routine, selected, today, !!session);

  const go = (by: number) => {
    const next = shiftMonth(month, by);
    setMonth(next);
    setSelected(next === today.slice(0, 7) ? today : `${next}-01`);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScreenHeader title="History" onBack />
      <ScrollView contentContainerStyle={styles.main}>
        <Card style={styles.calendar}>
          <View style={styles.monthRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => go(-1)} style={styles.navButton}>
              <ChevronLeft size={22} strokeWidth={2} color={colors.ink} />
            </Pressable>
            <Text accessibilityRole="header" style={styles.monthTitle}>
              {MONTHS[m - 1]} {y}
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => go(1)} style={styles.navButton}>
              <ChevronRight size={22} strokeWidth={2} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.grid}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <Text key={i} style={styles.weekday}>
                {d}
              </Text>
            ))}
            {monthCells(month).map((day, i) => {
              if (!day) return <View key={`b${i}`} style={styles.cell} />;
              const isSelected = day === selected;
              const trained = sessions.get(day)?.status === 'done' || (sessions.get(day)?.sets ?? 0) > 0;
              const fed = (food.get(day)?.entries ?? 0) > 0;
              return (
                <Pressable
                  key={day}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDayShort(day)}${trained ? ', trained' : ''}${fed ? ', food logged' : ''}`}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setSelected(day)}
                  style={[styles.cell, isSelected && styles.cellSelected, day === today && !isSelected && styles.cellToday]}
                >
                  <Text style={[styles.cellNum, day > today && styles.future, isSelected && styles.selectedText]}>
                    {Number(day.slice(8))}
                  </Text>
                  <View style={styles.dots}>
                    <View style={[styles.dot, trained && { backgroundColor: isSelected ? colors.white : colors.up }]} />
                    <View style={[styles.dot, fed && { backgroundColor: isSelected ? colors.accentOnDark : colors.accent }]} />
                  </View>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors.up }]} />
              <Text style={type.secondary}>Training</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <Text style={type.secondary}>Food</Text>
            </View>
          </View>
        </Card>

        <Text style={[type.eyebrow, styles.pad]}>{formatDayShort(selected)}</Text>

        {session ? (
          <DetailRow
            icon={<Dumbbell size={20} strokeWidth={2} color={colors.up} />}
            tint={colors.upSoft}
            title={session.routine_name ?? 'Workout'}
            sub={[`${session.sets} sets`, session.highlight ? describeSets(session.highlight.exercise, session.highlight.sets).replace(/^\w/, (c) => c.toLowerCase()) : null]
              .filter(Boolean)
              .join(' · ')}
            onPress={() => router.push({ pathname: '/session/[date]', params: { date: selected } })}
          />
        ) : missed && routine ? (
          <DetailRow
            icon={<Dumbbell size={20} strokeWidth={2} color={colors.hold} />}
            tint={colors.holdSoft}
            title={`Missed: ${routine.name}`}
            sub="Log it now"
            onPress={() => router.push({ pathname: '/workout', params: { date: selected } })}
          />
        ) : null}

        {dayFood ? (
          <DetailRow
            icon={<Utensils size={20} strokeWidth={2} color={colors.accent} />}
            tint={colors.accentSoft}
            title={`Food: ${formatKcal(dayFood.kcal)} kcal · ${dayFood.protein_g} g protein`}
            sub={`${dayFood.entries} ${dayFood.entries === 1 ? 'item' : 'items'} across ${dayFood.meals} ${dayFood.meals === 1 ? 'meal' : 'meals'}`}
            onPress={() => router.navigate('/food')}
          />
        ) : null}

        {!session && !dayFood && !missed ? <Text style={[type.secondary, styles.pad]}>Nothing logged.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ icon, tint, title, sub, onPress }: { icon: React.ReactNode; tint: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${sub}`} onPress={onPress} style={styles.detail}>
      <View style={[styles.detailIcon, { backgroundColor: tint }]}>{icon}</View>
      <View style={styles.detailText}>
        <Text style={styles.detailTitle}>{title}</Text>
        <Text style={type.secondary}>{sub}</Text>
      </View>
      <ChevronRight size={18} strokeWidth={2} color={colors.ink3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  main: { paddingHorizontal: 20, paddingBottom: 20, gap: 12 },
  calendar: { padding: 14, gap: 10 },
  monthRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontFamily: fonts.bodySemi, fontSize: 11, color: colors.ink3, paddingBottom: 4 },
  cell: { width: `${100 / 7}%`, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 3 },
  cellSelected: { backgroundColor: colors.accent },
  cellToday: { borderWidth: 1.5, borderColor: colors.accent },
  cellNum: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
  future: { color: colors.ink3 },
  selectedText: { color: colors.white, fontFamily: fonts.bodySemi },
  dots: { flexDirection: 'row', gap: 2, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  legend: { flexDirection: 'row', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pad: { paddingHorizontal: 2 },
  detail: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.button,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  detailIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  detailText: { flex: 1, gap: 2 },
  detailTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
});
