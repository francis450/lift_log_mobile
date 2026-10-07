import { Camera, ImageIcon } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { NetworkError } from '@/api/client';
import * as api from '@/api/endpoints';
import type { EstimateItem, FoodSource } from '@/api/types';
import { Button } from '@/components/Button';
import { useAuth } from '@/state/auth';
import { colors, fonts, radii, type } from '@/theme';

import { EstimateResults } from './EstimateResults';
import { chosenItems, EstimateRow, estimateRows } from './model';
import { getMealPhoto, MealPhoto } from './photo';

const OFFLINE = "You're offline. Photo and Describe need a connection; Search and Custom work offline.";

type Phase = 'idle' | 'estimating' | 'done' | 'error';

/** One cancellable estimate request at a time. */
function useEstimate() {
  const credentials = useAuth((s) => s.credentials);
  const [phase, setPhase] = useState<Phase>('idle');
  const [rows, setRows] = useState<EstimateRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function run(input: { text?: string; image_base64?: string; image_mime?: string }) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setPhase('estimating');
    setError(null);
    try {
      const result = await api.estimate(credentials!, input, current.signal);
      if (current.signal.aborted) return;
      setRows(estimateRows(result.items));
      setPhase('done');
    } catch (e) {
      if (current.signal.aborted) return;
      setError(e instanceof NetworkError ? OFFLINE : (e as Error).message);
      setPhase('error');
    }
  }

  function cancel() {
    controller.current?.abort();
    setPhase('idle');
  }

  return { phase, rows, setRows, error, run, cancel, reset: () => setPhase('idle') };
}

interface TabProps {
  onAddMany: (items: EstimateItem[], source: FoodSource) => void;
}

export function AiNotReady({ message }: { message: string }) {
  return (
    <View style={styles.notReady}>
      <Text style={type.bodyMedium}>{message}</Text>
      <Text style={type.secondary}>Search and Custom still work.</Text>
    </View>
  );
}

function Estimating({ onCancel }: { onCancel: () => void }) {
  return (
    <View style={styles.estimating} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.accent} />
      <Text style={[type.bodyMedium, styles.flex]}>Estimating…</Text>
      <Button variant="secondary" label="Cancel" height={44} onPress={onCancel} />
    </View>
  );
}

/** Photo: the camera opens at once; the photo (plus optional details) goes to the estimate endpoint. */
export function PhotoTab({ onAddMany }: TabProps) {
  const estimate = useEstimate();
  const [photo, setPhoto] = useState<MealPhoto | null>(null);
  const [details, setDetails] = useState('');
  const [pickError, setPickError] = useState<string | null>(null);
  const opened = useRef(false);

  async function pick(source: 'camera' | 'library') {
    setPickError(null);
    try {
      const taken = await getMealPhoto(source);
      if (!taken) return;
      setPhoto(taken);
      void estimate.run({ image_base64: taken.base64, image_mime: taken.mime, text: details.trim() || undefined });
    } catch (e) {
      setPickError((e as Error).message);
    }
  }

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void pick('camera');
    // Open the camera once, when the tab first shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const again = () =>
    photo && void estimate.run({ image_base64: photo.base64, image_mime: photo.mime, text: details.trim() || undefined });

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      {!photo || estimate.phase === 'idle' ? (
        <View style={styles.pickers}>
          {photo ? <Image source={{ uri: photo.uri }} style={styles.preview} accessibilityLabel="Your meal photo" /> : null}
          <Button label="Take photo" icon={<Camera size={20} strokeWidth={2} color={colors.white} />} onPress={() => pick('camera')} />
          <Button
            variant="secondary"
            label="Choose from library"
            icon={<ImageIcon size={20} strokeWidth={2} color={colors.ink} />}
            onPress={() => pick('library')}
          />
          {pickError ? <Text style={styles.error}>{pickError}</Text> : null}
        </View>
      ) : null}

      {photo && estimate.phase === 'estimating' ? (
        <View style={styles.pickers}>
          <Image source={{ uri: photo.uri }} style={styles.preview} accessibilityLabel="Your meal photo" />
          <Estimating onCancel={estimate.cancel} />
        </View>
      ) : null}

      {photo && estimate.phase === 'error' ? (
        <View style={styles.pickers}>
          <Text accessibilityRole="alert" style={styles.error}>
            {estimate.error}
          </Text>
          <Button label="Try again" onPress={again} />
          <Button variant="secondary" label="Retake photo" onPress={() => pick('camera')} />
        </View>
      ) : null}

      {photo && estimate.phase === 'done' ? (
        <EstimateResults
          rows={estimate.rows}
          onChange={estimate.setRows}
          summary="Estimated from the photo. Check the portions, especially oil in stews."
          photoUri={photo.uri}
          onRetake={() => pick('camera')}
          onAdd={() => onAddMany(chosenItems(estimate.rows), 'photo')}
        />
      ) : null}

      {photo && (estimate.phase === 'done' || estimate.phase === 'error') ? (
        <View style={styles.details}>
          <TextInput
            accessibilityLabel="Details the photo doesn't show"
            value={details}
            onChangeText={setDetails}
            placeholder="Anything the photo doesn't show? (optional)"
            placeholderTextColor={colors.ink3}
            style={styles.input}
          />
          {details.trim() ? <Button variant="secondary" label="Estimate again" height={44} onPress={again} /> : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

/** Describe: free text to the same estimate endpoint. */
export function DescribeTab({ onAddMany }: TabProps) {
  const estimate = useEstimate();
  const [text, setText] = useState('');

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      {estimate.phase === 'done' ? (
        <EstimateResults
          rows={estimate.rows}
          onChange={estimate.setRows}
          summary="Estimated from your description. Check the portions."
          onRetake={estimate.reset}
          onAdd={() => onAddMany(chosenItems(estimate.rows), 'describe')}
        />
      ) : (
        <>
          <TextInput
            accessibilityLabel="What you ate"
            value={text}
            onChangeText={setText}
            placeholder="2 chapati, beef stew, chai with sugar"
            placeholderTextColor={colors.ink3}
            multiline
            autoFocus
            maxLength={1500}
            style={[styles.input, styles.describe]}
          />
          {estimate.phase === 'estimating' ? (
            <Estimating onCancel={estimate.cancel} />
          ) : (
            <Button label="Estimate" disabled={!text.trim()} onPress={() => void estimate.run({ text: text.trim() })} />
          )}
          {estimate.phase === 'error' ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {estimate.error}
            </Text>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: 12, paddingBottom: 12 },
  pickers: { gap: 12 },
  preview: { width: '100%', height: 200, borderRadius: radii.button, backgroundColor: colors.track },
  estimating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface2,
    borderRadius: radii.button,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  error: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 20, color: colors.danger },
  details: { gap: 8 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radii.inner,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  describe: { minHeight: 120, textAlignVertical: 'top' },
  notReady: { gap: 6, backgroundColor: colors.holdSoft, borderRadius: radii.button, padding: 16 },
});
