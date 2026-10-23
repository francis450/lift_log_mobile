import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ExerciseInfo, Routine } from '@/api/types';
import { CallChip } from '@/components/CallChip';
import { callSentence, chipKind, NextCall } from '@/lib/nextCall';
import { colors, fonts, radii, type } from '@/theme';

import { exerciseInfo, targetLine } from './model';

interface Props {
  routine: Routine;
  library: Record<string, ExerciseInfo> | undefined;
  /** Add-weight calls per exercise; left out for the home deload. */
  calls?: Record<string, NextCall>;
}

/** The day's exercises before Start workout: what's planned and the weight to use. Nothing is logged here. */
export function WorkoutPreview({ routine, library, calls }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.main}>
      {routine.note ? <Text style={type.secondary}>{routine.note}</Text> : null}
      {(routine.items ?? []).map((item, i) => {
        const call = calls?.[item.exercise];
        return (
          <View key={item.exercise} style={styles.row}>
            {item.finisher ? <Text style={type.eyebrow}>Forearm finisher</Text> : null}
            <View style={styles.top}>
              <Text style={styles.number}>{i + 1}</Text>
              <View style={styles.text}>
                <Text accessibilityRole="header" style={styles.name}>
                  {item.exercise}
                </Text>
                <Text style={styles.target}>{targetLine(item, exerciseInfo(library, item.exercise))}</Text>
              </View>
            </View>
            {call ? <CallChip kind={chipKind(call.call)} label={callSentence(call)} /> : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  main: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, gap: 8 },
  row: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.inner,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  number: { fontFamily: fonts.displaySemi, fontSize: 22, color: colors.ink3, width: 20, textAlign: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  target: { fontFamily: fonts.mono, fontSize: 13, color: colors.ink2 },
});
