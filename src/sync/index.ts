// Wires the sync queue to the API, connectivity and app focus.

import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import { ApiError } from '@/api/client';
import * as api from '@/api/endpoints';
import type { ProfileUpdate } from '@/api/types';
import { useAuth } from '@/state/auth';
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
    default:
      throw new Error(`No sender for ${item.kind} yet`);
  }
}

export const syncQueue = createSyncQueue({
  store: sqliteOutbox,
  send,
  events: {
    onConflict: async () => {
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
