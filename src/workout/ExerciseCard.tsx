import * as Linking from 'expo-linking';
import { PlayCircle } from 'lucide-react-native';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ExerciseInfo, RoutineItem } from '@/api/types';
import { CallChip } from '@/components/CallChip';
import { Card } from '@/components/Card';
import { SetRating } from '@/components/SetRating';
import { SetRow } from '@/components/SetRow';
import { bigStep, callSentence, chipKind, NextCall, parseRepRange, rirOf, stepUp } from '@/lib/nextCall';
import { colors, fonts, type } from '@/theme';

import { amountUnit, DraftRow, kgLabels, setNumbers, targetLine, usesKg } from './model';

interface Props {
  item: RoutineItem;
  info: ExerciseInfo;
  call: NextCall | undefined;
  rows: DraftRow[];
  placeholders: string[];
  onChangeRow: (index: number, patch: Partial<DraftRow>) => void;
  onToggleDone: (index: number) => void;
  onRir: (index: number, rir: number | null) => void;
  onWarmup: (index: number, warmup: boolean) => void;
  onAddSet: () => void;
}

const HEADER: Record<string, string> = { reps: 'Reps', seconds: 'Secs', metres: 'Metres' };

export function ExerciseCard({
  item,
  info,
  call,
  rows,
  placeholders,
  onChangeRow,
  onToggleDone,
  onRir,
  onWarmup,
  onAddSet,
}: Props) {
  const showKg = usesKg(info);
  const unit = amountUnit(info);
  const active = rows.findIndex((r) => !r.done);
  const numbers = setNumbers(rows);
  const sided = rows.some((r) => r.side);
  const labels = kgLabels(info);
  // Same test as the add-weight rule: a jump of over 10% needs 2 reps past the top of the range first.
  const bigJump =
    info.type === 'load' && call?.kg !== undefined && bigStep(call.kg, stepUp(call.kg, info.increment_kg) - call.kg);
  const top = parseRepRange(item.reps)?.[1];
  return (
    <Card style={styles.card}>
      {item.finisher ? <Text style={[type.eyebrow, styles.finisher]}>Forearm finisher</Text> : null}
      <View style={styles.top}>
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={styles.name}>
            {item.exercise}
          </Text>
          <Text style={styles.target}>{targetLine(item, info)}</Text>
        </View>
        {info.form_url ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Form video for ${item.exercise}`}
            onPress={() => Linking.openURL(info.form_url!)}
            style={styles.form}
          >
            <PlayCircle size={18} strokeWidth={2} color={colors.accent} />
            <Text style={styles.formText}>Form</Text>
          </Pressable>
        ) : null}
      </View>

      {call ? <CallChip kind={chipKind(call.call)} label={callSentence(call)} /> : null}

      <View style={styles.headerRow}>
        <Text style={[type.eyebrow, styles.setCol, sided && styles.setColSide]}>Set</Text>
        {showKg ? <Text style={[type.eyebrow, styles.flex]}>{labels.header}</Text> : null}
        <Text style={[type.eyebrow, styles.flex]}>{HEADER[unit]}</Text>
        <View style={styles.tickCol} />
      </View>

      {rows.map((row, i) => (
        <Fragment key={i}>
          <SetRow
            setNo={numbers[i]}
            side={row.side}
            kgLabel={labels.field}
            kg={row.kg}
            reps={row.reps}
            repsPlaceholder={placeholders[i]}
            repsLabel={unit}
            showKg={showKg}
            done={row.done}
            active={i === active}
            onChangeKg={(kg) => onChangeRow(i, { kg })}
            onChangeReps={(reps) => onChangeRow(i, { reps })}
            onToggleDone={() => onToggleDone(i)}
          />
          {row.done ? (
            <View style={[styles.effort, sided && styles.effortSide]}>
              <SetRating
                rir={row.rir ?? rirOf(row)}
                warmup={!!row.warmup}
                onRir={(rir) => onRir(i, rir)}
                onWarmup={(warmup) => onWarmup(i, warmup)}
              />
            </View>
          ) : null}
        </Fragment>
      ))}

      <Text style={styles.legend}>
        {info.type === 'assisted'
          ? 'Reps left: how many more clean reps you had. Log the machine\'s help in kg; less help is progress.'
          : bigJump && top !== undefined
            ? `Reps left: how many more clean reps you had. Aim for 1–3. The next weight is a big jump, so reach ${top + 2} reps on every set first. Mark warm-ups so they don't count.`
            : 'Reps left: how many more clean reps you had. Aim for 1–3. Mark warm-ups so they don\'t count.'}
      </Text>
      <Pressable accessibilityRole="button" onPress={onAddSet} style={styles.addSet}>
        <Text style={styles.addSetText}>+ Add set</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  finisher: { color: colors.accent },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  titles: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.display, fontSize: 28, lineHeight: 30, color: colors.ink },
  target: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink2 },
  form: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
  },
  formText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.accent },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setCol: { width: 24, textAlign: 'center' },
  setColSide: { width: 32 },
  flex: { flex: 1, textAlign: 'center' },
  tickCol: { width: 48 },
  effort: { paddingLeft: 32 },
  effortSide: { paddingLeft: 40 },
  legend: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.ink3 },
  addSet: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lineStrong,
    justifyContent: 'center',
  },
  addSetText: { fontFamily: fonts.body, fontSize: 14, color: colors.ink2 },
});
