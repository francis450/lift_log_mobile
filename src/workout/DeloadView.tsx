import { Check } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Routine } from '@/api/types';
import { colors, fonts, radii, type } from '@/theme';

import type { WorkoutDraft } from './model';

// Coaching tips from the Home deload design.
const TIPS: Record<string, string> = {
  'Push-ups': 'Knees down is fine',
  'Pike push-ups': 'Hips high, head between hands',
  'Chair Bulgarian split squat': 'Back foot on the chair',
  'Glute bridge': 'Squeeze at the top',
  Plank: 'Straight line, slow breaths',
  'Water bottle wrist curl': 'Full bottles, slow',
};

const ROUNDS = [1, 2, 3];

/** "8 / leg", "45 s", "10–15" */
function prescription(reps: string, note: string | undefined, exercise: string): string {
  const r = reps.replace('-', '–');
  if (note?.startsWith('per ')) return `${r} / ${note.slice(4)}`;
  if (exercise === 'Plank') return `${r} s`;
  return r;
}

interface Props {
  routine: Routine;
  draft: WorkoutDraft;
  onRound: (round: number) => void;
  onTick: (exercise: string, round: number) => void;
}

/** Week 4: a three-round checklist of bodyweight moves. No weights, no add-weight calls. */
export function DeloadView({ routine, draft, onRound, onTick }: Props) {
  const round = draft.round ?? 1;
  const ticks = draft.ticks ?? {};
  const roundDone = (r: number) => (routine.items ?? []).every((i) => (ticks[i.exercise] ?? []).includes(r));
  return (
    <ScrollView contentContainerStyle={styles.main}>
      {routine.note ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>{routine.note}</Text>
        </View>
      ) : null}

      <View style={styles.roundCard}>
        <View>
          <Text style={type.eyebrow}>Round</Text>
          <Text style={styles.roundBig}>
            {round} <Text style={styles.roundOf}>of 3</Text>
          </Text>
        </View>
        <View style={styles.roundButtons}>
          {ROUNDS.map((r) => {
            const done = r !== round && roundDone(r);
            const current = r === round;
            return (
              <Pressable
                key={r}
                accessibilityRole="button"
                accessibilityLabel={`Round ${r}${done ? ', done' : ''}`}
                accessibilityState={{ selected: current }}
                onPress={() => onRound(r)}
                style={[styles.roundButton, done && styles.roundDone, current && styles.roundCurrent]}
              >
                <Text style={[styles.roundText, done && styles.roundTextDone, current && styles.roundTextCurrent]}>{r}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.list}>
        {(routine.items ?? []).map((item, i) => {
          const checked = (ticks[item.exercise] ?? []).includes(round);
          return (
            <Pressable
              key={item.exercise}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={`${item.exercise}, ${prescription(item.reps, item.note, item.exercise)}`}
              onPress={() => onTick(item.exercise, round)}
              style={[styles.move, i > 0 && styles.divider]}
            >
              <View style={[styles.box, checked && styles.boxChecked]}>
                {checked ? <Check size={16} strokeWidth={2} color={colors.white} /> : null}
              </View>
              <View style={styles.moveText}>
                <Text style={type.bodyMedium}>{item.exercise}</Text>
                {TIPS[item.exercise] ? <Text style={[type.secondary, styles.tip]}>{TIPS[item.exercise]}</Text> : null}
              </View>
              <Text style={styles.rx}>{prescription(item.reps, item.note, item.exercise)}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  main: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12, gap: 12 },
  note: { backgroundColor: colors.ink, borderRadius: radii.card, padding: 16 },
  noteText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.onDarkMuted },
  roundCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.card,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roundBig: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36, color: colors.ink },
  roundOf: { fontSize: 18, color: colors.ink3 },
  roundButtons: { flexDirection: 'row', gap: 6 },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundDone: { backgroundColor: colors.up, borderColor: colors.up },
  roundCurrent: { borderWidth: 2, borderColor: colors.accent },
  roundText: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink2 },
  roundTextDone: { color: colors.white },
  roundTextCurrent: { color: colors.accent },
  list: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.card,
    paddingHorizontal: 16,
  },
  move: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.track },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.up, borderColor: colors.up },
  moveText: { flex: 1 },
  tip: { fontSize: 12, lineHeight: 16 },
  rx: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink2 },
});
