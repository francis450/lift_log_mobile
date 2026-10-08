import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { useTimeZone } from '@/hooks/queries';
import { formatDayShort, todayIn } from '@/lib/dates';
import { formatSeconds } from '@/components/RestTimer';
import { colors, fonts, type } from '@/theme';
import { DeloadView } from '@/workout/DeloadView';
import { ExerciseCard } from '@/workout/ExerciseCard';
import { LiveRestTimer } from '@/workout/LiveRestTimer';
import { exerciseInfo, targetLine } from '@/workout/model';
import { useWorkout } from '@/workout/useWorkout';

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  return (
    <Text accessibilityLabel={`${Math.floor(seconds / 60)} minutes in`} style={styles.elapsed}>
      {formatSeconds(seconds)}
    </Text>
  );
}

export default function WorkoutScreen() {
  useKeepAwake();
  const tz = useTimeZone();
  const params = useLocalSearchParams<{ date?: string; from?: string }>();
  const date = params.date ?? todayIn(tz);
  const w = useWorkout(date, params.from);
  const [noteOpen, setNoteOpen] = useState(false);
  const scroll = useRef<ScrollView>(null);

  const draft = w.draft;
  const routine = w.routine;
  const isDeload = routine?.key === 'home_deload';
  // A finished session opened again (from its summary) is being edited.
  const editing = draft?.status === 'done';

  async function finish() {
    const logged = draft ? Object.values(draft.rows).flat().filter((r) => r.reps).length : 0;
    const ticked = draft ? Object.values(draft.ticks ?? {}).flat().length : 0;
    if (!logged && !ticked) {
      const ok = await new Promise<boolean>((resolve) =>
        Alert.alert('No sets logged', 'Finish anyway? Nothing will show in your history.', [
          { text: 'Keep going', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Finish', onPress: () => resolve(true) },
        ]),
      );
      if (!ok) return;
    }
    await w.finish();
    router.replace({ pathname: '/session/[date]', params: { date } });
  }

  const header = (eyebrow: string, title: string) => (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}>
        <ChevronLeft size={24} strokeWidth={2} color={colors.ink} />
      </Pressable>
      <View style={styles.headerText}>
        <Text style={type.eyebrow}>{eyebrow}</Text>
        <Text accessibilityRole="header" style={type.pushedTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {draft && draft.status === 'in_progress' ? <Elapsed since={draft.started_at} /> : null}
    </View>
  );

  if (!w.ready) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (!routine?.items?.length || !draft) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        {header(formatDayShort(date), routine?.name ?? 'Workout')}
        <View style={styles.main}>
          <Card>
            <Text style={type.body}>No session is planned for this day.</Text>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  if (isDeload) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {header(`${formatDayShort(date)} · Week ${w.week} · Exam week`, routine.name)}
        <DeloadView routine={routine} draft={draft} onRound={w.setRound} onTick={w.toggleTick} />
        <View style={styles.footer}>
          <Button label={editing ? 'Save changes' : 'Finish deload session'} onPress={finish} style={styles.flex} />
        </View>
      </SafeAreaView>
    );
  }

  const items = w.items;
  const index = Math.min(draft.current, items.length - 1);
  const item = items[index];
  const info = exerciseInfo(w.library, item.exercise);
  const isLast = index === items.length - 1;
  const goTo = (i: number) => {
    w.goTo(i);
    scroll.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {header(
        `${formatDayShort(date)} · ${editing ? 'Editing · ' : ''}Exercise ${index + 1} of ${items.length}`,
        routine.name,
      )}
      <View
        style={styles.progress}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: items.length, now: index + 1 }}
      >
        <View style={[styles.progressFill, { width: `${((index + 1) / items.length) * 100}%` }]} />
      </View>

      <ScrollView ref={scroll} contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled">
        <ExerciseCard
          key={item.exercise}
          item={item}
          info={info}
          call={w.suggestions[item.exercise]}
          rows={draft.rows[item.exercise] ?? []}
          placeholders={w.placeholders[item.exercise] ?? []}
          onChangeRow={(i, patch) => w.setRow(item.exercise, i, patch)}
          onToggleDone={(i) => w.toggleDone(item, i)}
          onEffort={(i, effort) => w.setEffort(item.exercise, i, effort)}
          onAddSet={() => w.addSet(item.exercise)}
        />

        <LiveRestTimer endsAt={draft.restEndsAt} onAdd30={() => w.addRest(30)} onSkip={w.skipRest} />

        {items.length > 1 ? (
          <View style={styles.list}>
            {items.map((x, i) => {
              if (i === index) return null;
              const logged = (draft.rows[x.exercise] ?? []).filter((r) => r.done).length;
              return (
                <Pressable
                  key={x.exercise}
                  accessibilityRole="button"
                  accessibilityLabel={`Go to ${x.exercise}`}
                  onPress={() => goTo(i)}
                  style={styles.nextRow}
                >
                  <Text style={[type.bodyMedium, styles.flex, logged ? styles.doneName : null]} numberOfLines={1}>
                    {x.exercise}
                  </Text>
                  <Text style={styles.nextRx}>
                    {logged ? `${logged} done` : targetLine(x, exerciseInfo(w.library, x.exercise)).split(' · ')[0]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button variant="secondary" label={draft.note ? 'Edit note' : 'Note'} onPress={() => setNoteOpen(true)} style={styles.flex} />
        {editing ? (
          <Button label="Save changes" onPress={finish} style={styles.flex2} />
        ) : (
          <Button
            label={isLast ? 'Finish workout' : 'Next exercise'}
            onPress={() => (isLast ? finish() : goTo(index + 1))}
            style={styles.flex2}
          />
        )}
      </View>

      {noteOpen ? (
        <NoteSheet
          initial={draft.note}
          onClose={() => setNoteOpen(false)}
          onSave={(note) => {
            w.setNote(note);
            setNoteOpen(false);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function NoteSheet({ initial, onClose, onSave }: { initial: string; onClose: () => void; onSave: (note: string) => void }) {
  const [text, setText] = useState(initial);
  return (
    <BottomSheet visible title="Note" onClose={onClose}>
      <TextInput
        accessibilityLabel="Workout note"
        value={text}
        onChangeText={setText}
        multiline
        autoFocus
        placeholder="How did it go?"
        placeholderTextColor={colors.ink3}
        style={styles.noteInput}
      />
      <Button label="Save note" onPress={() => onSave(text.trim())} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, minWidth: 0 },
  elapsed: { fontFamily: fonts.mono, fontSize: 14, color: colors.ink2, paddingRight: 8 },
  progress: { height: 4, marginHorizontal: 20, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.accent },
  main: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, gap: 12 },
  list: { gap: 6 },
  nextRow: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  doneName: { color: colors.ink2 },
  nextRx: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink2 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  flex: { flex: 1 },
  flex2: { flex: 2 },
  noteInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 14,
    padding: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    textAlignVertical: 'top',
  },
});
