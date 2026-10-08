import { router, useLocalSearchParams } from 'expo-router';
import { Send } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NetworkError } from '@/api/client';
import * as api from '@/api/endpoints';
import type { WeeklyReview } from '@/api/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StatTile } from '@/components/StatTile';
import { Toggle } from '@/components/Toggle';
import { useProfile, useTimeZone } from '@/hooks/queries';
import { todayIn } from '@/lib/dates';
import { weekFor } from '@/lib/program';
import { periodLabel, statTiles } from '@/lib/review';
import { regenerateReview, useReviewStats, useWeeklyReview } from '@/review/data';
import { useAuth } from '@/state/auth';
import { useNotice } from '@/state/notice';
import { queryClient } from '@/state/queryClient';
import { colors, fonts, radii, type } from '@/theme';

export default function WeeklyReviewScreen() {
  const params = useLocalSearchParams<{ week?: string }>();
  const tz = useTimeZone();
  const program = useProfile().data?.program;
  const today = todayIn(tz);
  const week = Number(params.week) || (program ? (weekFor(program, today) ?? program.weeks.length) : 1);
  const stats = useReviewStats(week);
  const review = useWeeklyReview(week);
  const data = review.data;
  const tiles = data ? statTiles(data.stats) : stats.data ? statTiles(stats.data) : null;
  const period = data?.stats.period ?? stats.data?.period;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior="padding" style={styles.root}>
        <ScreenHeader
          eyebrow={`Week ${week}${period ? ` · ${periodLabel(period)}` : ''} · by Claude`}
          title="Weekly review"
          onBack
        />
        <ScrollView contentContainerStyle={styles.main} keyboardShouldPersistTaps="handled">
          {tiles ? (
            <View style={styles.tiles}>
              {tiles.map((t) => (
                <StatTile key={t.caption} value={t.value} caption={t.caption} />
              ))}
            </View>
          ) : null}

          {data ? (
            <ReviewBody review={data} week={week} />
          ) : review.isError ? (
            <Card>
              <Text style={type.body}>
                {review.error instanceof NetworkError
                  ? 'The weekly review needs a connection. Try again when you are online.'
                  : (review.error as Error).message}
              </Text>
              <Button variant="secondary" label="Try again" onPress={() => review.refetch()} />
            </Card>
          ) : (
            <Card style={styles.waiting}>
              <ActivityIndicator color={colors.accent} />
              <Text style={[type.body, styles.flex]}>Claude is reviewing your week…</Text>
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ReviewBody({ review, week }: { review: WeeklyReview; week: number }) {
  const credentials = useAuth((s) => s.credentials);
  const showNotice = useNotice((s) => s.show);
  const anyAccepted = review.changes.some((c) => c.accepted);
  // Proposed changes start switched on; after applying, they show what was applied.
  const [on, setOn] = useState<boolean[]>(review.changes.map((c) => (anyAccepted ? !!c.accepted : true)));
  const [applying, setApplying] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const count = on.filter(Boolean).length;
  const nextWeek = week + 1;

  async function apply() {
    if (!credentials) return;
    setApplying(true);
    try {
      const accepted = on.flatMap((v, i) => (v ? [i] : []));
      const updated = await api.applyChanges(credentials, week, accepted);
      queryClient.setQueryData(['weekly-review', week], updated);
      void queryClient.invalidateQueries({ queryKey: ['plan-changes'] });
      showNotice(count ? `Applied ${count} ${count === 1 ? 'change' : 'changes'} to week ${nextWeek}` : 'No changes applied');
      router.navigate('/train');
    } catch (e) {
      showNotice((e as Error).message);
      setApplying(false);
    }
  }

  async function rewrite() {
    setRewriting(true);
    try {
      const fresh = await regenerateReview(week);
      setOn(fresh.changes.map(() => true));
    } catch (e) {
      showNotice((e as Error).message);
    } finally {
      setRewriting(false);
    }
  }

  return (
    <>
      <Card style={styles.text}>
        <Text style={[styles.heading, { color: colors.up }]}>Went well</Text>
        <Text style={styles.paragraph}>{review.went_well}</Text>
        <Text style={[styles.heading, styles.headingGap, { color: colors.hold }]}>To change</Text>
        <Text style={styles.paragraph}>{review.to_change}</Text>
      </Card>

      {review.changes.length ? (
        <Card style={styles.changes}>
          <Text style={[type.eyebrow, styles.changesTitle]}>Proposed for next week</Text>
          {review.changes.map((c, i) => (
            <View key={`${c.title}-${i}`} style={styles.change}>
              <View style={styles.flex}>
                <Text style={styles.changeTitle}>{c.title}</Text>
                {c.why ? <Text style={[type.secondary, styles.small]}>{c.why}</Text> : null}
              </View>
              <Toggle
                accessibilityLabel={c.title}
                value={on[i]}
                onChange={(v) => setOn(on.map((x, j) => (j === i ? v : x)))}
              />
            </View>
          ))}
        </Card>
      ) : null}

      <FollowUp week={week} />

      <Pressable accessibilityRole="button" onPress={rewrite} disabled={rewriting} style={styles.rewrite}>
        {rewriting ? <ActivityIndicator color={colors.accent} /> : <Text style={styles.rewriteText}>Ask Claude to write it again</Text>}
      </Pressable>

      <Button
        label={
          review.changes.length
            ? count
              ? `Apply ${count} ${count === 1 ? 'change' : 'changes'} to week ${nextWeek}`
              : `Apply no changes to week ${nextWeek}`
            : 'Done'
        }
        loading={applying}
        onPress={review.changes.length ? apply : () => router.back()}
      />
    </>
  );
}

function FollowUp({ week }: { week: number }) {
  const credentials = useAuth((s) => s.credentials);
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function ask() {
    const q = question.trim();
    if (!q || !credentials) return;
    setBusy(true);
    setAsked(q);
    setAnswer(null);
    try {
      setAnswer((await api.reviewFollowup(credentials, week, q)).answer);
      setQuestion('');
    } catch (e) {
      setAnswer(e instanceof NetworkError ? 'This needs a connection.' : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <View style={styles.ask}>
        <TextInput
          accessibilityLabel="Ask Claude about this week"
          value={question}
          onChangeText={setQuestion}
          placeholder="Ask about this week…"
          placeholderTextColor={colors.ink3}
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={ask}
          style={styles.askInput}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          disabled={busy || !question.trim()}
          onPress={ask}
          style={styles.send}
        >
          {busy ? <ActivityIndicator color={colors.accent} /> : <Send size={20} strokeWidth={2} color={colors.accent} />}
        </Pressable>
      </View>
      {asked ? (
        <Card style={styles.answer}>
          <Text style={type.eyebrow}>{asked}</Text>
          {answer ? (
            <Text accessibilityLiveRegion="polite" style={styles.paragraph}>
              {answer}
            </Text>
          ) : (
            <Text style={type.secondary}>Claude is thinking…</Text>
          )}
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  main: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 20, gap: 10 },
  tiles: { flexDirection: 'row', gap: 8 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  text: { paddingVertical: 14, gap: 8 },
  heading: { fontFamily: fonts.display, fontSize: 20 },
  headingGap: { marginTop: 4 },
  paragraph: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink },
  changes: { paddingVertical: 8, gap: 0 },
  changesTitle: { paddingTop: 8, paddingBottom: 2 },
  change: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.track },
  changeTitle: { fontFamily: fonts.bodySemi, fontSize: 15, color: colors.ink },
  small: { fontSize: 12, lineHeight: 16 },
  ask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.button,
    paddingLeft: 14,
    paddingRight: 4,
    paddingVertical: 4,
  },
  askInput: { flex: 1, height: 44, fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  send: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  answer: { gap: 6 },
  rewrite: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  rewriteText: { fontFamily: fonts.bodySemi, fontSize: 13, color: colors.accent },
});
