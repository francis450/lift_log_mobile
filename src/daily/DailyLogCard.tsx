import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TodayResponse } from '@/api/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { TextField } from '@/components/TextField';
import { nowUtcIso } from '@/lib/dates';
import { useNotice } from '@/state/notice';
import { queryClient } from '@/state/queryClient';
import { enqueueAndSync } from '@/sync';
import { colors, fonts, type } from '@/theme';

import { applyDailyPayload, dailyErrors, dailyPayload, DailyForm, formFromLog, trendLine } from './model';

export function dailyLogKey(data: TodayResponse): string {
  return `${data.date}|${data.daily?.client_updated_at ?? ''}`;
}

const PAIN_ROWS = [
  [0, 1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
];

/**
 * Morning log on Today: weight, last night's sleep, steps and back pain. Saves through the outbox,
 * so it works offline; each save sends only what changed, so steps can be added in the evening.
 * Render it with `key={dailyLogKey(data)}` so a new day or a newer server copy starts fresh fields.
 */
export function DailyLogCard({ data }: { data: TodayResponse }) {
  const showNotice = useNotice((s) => s.show);
  const saved = data.daily ?? null;
  const [form, setForm] = useState<DailyForm>(() => formFromLog(saved));
  const [touched, setTouched] = useState(false);

  const errors = dailyErrors(form);
  const payload = dailyPayload(data.date, form, saved, nowUtcIso());
  const set = (patch: Partial<DailyForm>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    setTouched(true);
    if (errors.weight || errors.sleep || errors.steps || !payload) return;
    queryClient.setQueryData<TodayResponse>(['today', data.date], (d) =>
      d ? { ...d, daily: applyDailyPayload(d.daily, payload) } : d,
    );
    await enqueueAndSync('daily_log', data.date, payload, true);
    showNotice('Saved');
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Morning log</Text>
        {saved?.weight_kg ? <Text style={styles.done}>Weighed in</Text> : null}
      </View>
      <View style={styles.pair}>
        <TextField
          label="Weight (kg)"
          variant="numeric"
          value={form.weight}
          onChangeText={(weight) => set({ weight })}
          placeholder="after the toilet"
          keyboardType="decimal-pad"
          error={touched ? errors.weight : null}
        />
        <TextField
          label="Sleep (hours)"
          variant="numeric"
          value={form.sleep}
          onChangeText={(sleep) => set({ sleep })}
          placeholder="last night"
          keyboardType="decimal-pad"
          error={touched ? errors.sleep : null}
        />
      </View>
      <TextField
        label="Steps"
        variant="numeric"
        value={form.steps}
        onChangeText={(steps) => set({ steps })}
        placeholder="from your phone, add in the evening"
        keyboardType="number-pad"
        error={touched ? errors.steps : null}
      />
      <View style={styles.pain}>
        <Text style={styles.label}>Lower back pain today (0 = none, 10 = worst)</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Lower back pain" style={styles.painRows}>
          {PAIN_ROWS.map((row) => (
            <View key={row[0]} style={styles.painRow}>
              {row.map((n) => {
                const selected = form.pain === n;
                return (
                  <Pressable
                    key={n}
                    accessibilityRole="radio"
                    accessibilityLabel={`Pain ${n} of 10`}
                    accessibilityState={{ checked: selected }}
                    onPress={() => set({ pain: selected ? null : n })}
                    style={[styles.painButton, selected && (n >= 4 ? styles.painHigh : styles.painSelected)]}
                  >
                    <Text style={[styles.painText, selected && styles.painTextSelected]}>{n}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        {form.pain !== null && form.pain >= 4 ? (
          <Text style={styles.warn}>
            Pain of 4 or more: skip lifts that bring it on, and see a doctor or physio if it lasts, spreads down a leg,
            or comes with numbness.
          </Text>
        ) : null}
      </View>
      <Text style={type.secondary}>{trendLine(data.weight_trend)}</Text>
      <Button label="Save" variant={payload ? 'primary' : 'secondary'} height={44} onPress={save} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: type.cardTitle,
  done: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.up },
  pair: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  pain: { gap: 6 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink2 },
  painRows: { gap: 6 },
  painRow: { flexDirection: 'row', gap: 6 },
  painButton: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  painSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  painHigh: { backgroundColor: colors.hold, borderColor: colors.hold },
  painText: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.ink },
  painTextSelected: { color: colors.white },
  warn: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.hold },
});
