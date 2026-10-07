// Wires the sync queue to the API, connectivity and app focus.

import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import { ApiError } from '@/api/client';
import * as api from '@/api/endpoints';
import type { CheckinPayload, FoodDay, FoodItem, Profile, ProfileUpdate, Session, SessionPayload } from '@/api/types';
import { workoutPut } from '@/db/database';
import { markFoodDaySynced } from '@/food/store';
import { routineFor } from '@/lib/program';
import { useAuth } from '@/state/auth';
import { fromSession } from '@/workout/model';
import { useNotice } from '@/state/notice';
import { queryClient } from '@/state/queryClient';

import { createSyncQueue, OutboxItem, OutboxKind } from './queue';
import { sqliteOutbox } from './sqliteOutbox';

async function send(item: OutboxItem): Promise<void> {
  const credentials = useAuth.getState().credentials;
  if (!credentials) throw new ApiError('Not signed in.', 401);
  switch (item.kind) {
    case 'profile':
      queryClient.setQueryData(['profile'], await api.saveProfile(credentials, item.payload as ProfileUpdate));
      return;
    case 'session':
      await api.saveSession(credentials, item.payload as SessionPayload);
      void queryClient.invalidateQueries({ queryKey: ['sessions-month'] });
      return;
    case 'food_day': {
      const sent = item.payload as FoodDay;
      await markFoodDaySynced(sent, await api.saveFoodDay(credentials, sent));
      void queryClient.invalidateQueries({ queryKey: ['food-month'] });
      return;
    }
    case 'food_item':
      await api.saveFoodItem(credentials, item.payload as Omit<FoodItem, 'name'>);
      return;
    case 'checkin':
      await api.saveCheckin(credentials, item.payload as CheckinPayload);
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      void queryClient.invalidateQueries({ queryKey: ['progress'] });
      return;
    default:
      throw new Error(`No sender for ${item.kind} yet`);
  }
}

/** The server copy wins: store it locally in place of ours. */
async function takeServerCopy(item: OutboxItem, stored: unknown) {
  if (item.kind === 'session' && stored) {
    const session = stored as Session;
    const program = queryClient.getQueryData<Profile>(['profile'])?.program;
    const routine = program ? routineFor(program, session.session_date) : null;
    await workoutPut(session.session_date, fromSession(session, routine));
  }
  if (item.kind === 'food_day' && stored) {
    await markFoodDaySynced(null, stored as FoodDay);
  }
}

export const syncQueue = createSyncQueue({
  store: sqliteOutbox,
  send,
  events: {
    onConflict: async (item, stored) => {
      await takeServerCopy(item, stored);
      useNotice.getState().show('Updated from another device');
      await queryClient.invalidateQueries();
    },
    onDropped: (_item, error) => {
      useNotice.getState().show(`Couldn't save a change: ${error.message}`);
    },
    onAuthExpired: () => {
      useNotice.getState().show('Your sign-in has expired. Sign in again.');
    },
  },
});

let retryTimer: ReturnType<typeof setTimeout> | null = null;

async function flushAndReschedule() {
  if (!useAuth.getState().credentials) return;
  await syncQueue.flush();
  const next = await syncQueue.nextAttemptAt();
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = next === null ? null : setTimeout(flushAndReschedule, Math.max(next - Date.now(), 1_000));
}

/** Queue a write and try to send it straight away. */
export async function enqueueAndSync(kind: OutboxKind, key: string, payload: unknown, merge = false) {
  await syncQueue.enqueue(kind, key, payload, merge);
  void flushAndReschedule();
}

/** Flush on start, when the connection comes back, and when the app returns to the foreground. */
export function startSync(): () => void {
  void flushAndReschedule();
  const unsubscribeNet = NetInfo.addEventListener((state) => {
    if (state.isConnected) void flushAndReschedule();
  });
  const appState = AppState.addEventListener('change', (state) => {
    if (state === 'active') void flushAndReschedule();
  });
  return () => {
    unsubscribeNet();
    appState.remove();
    if (retryTimer) clearTimeout(retryTimer);
  };
}
