// Signed-in state. The API token lives in SecureStore, never in SQLite or plain storage.

import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { Credentials, normalizeServer } from '@/api/client';
import * as api from '@/api/endpoints';
import { clearLocalData } from '@/db/database';
import { cancelReminders } from '@/reminders';

import { queryClient } from './queryClient';

const SESSION_KEY = 'liftlog.session';

interface StoredSession extends Credentials {
  user: string;
  fullName: string;
  hasProfile: boolean;
}

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  credentials: Credentials | null;
  user: string | null;
  fullName: string | null;
  hasProfile: boolean;
  /** Last server address used, to prefill Sign in. */
  lastServer: string | null;
  restore: () => Promise<void>;
  signIn: (server: string, usr: string, pwd: string) => Promise<void>;
  setHasProfile: (hasProfile: boolean) => Promise<void>;
  signOut: () => Promise<void>;
}

async function persist(session: StoredSession | null) {
  if (session) await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(SESSION_KEY);
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'loading',
  credentials: null,
  user: null,
  fullName: null,
  hasProfile: false,
  lastServer: null,

  async restore() {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    const lastServer = await SecureStore.getItemAsync('liftlog.lastServer');
    if (!raw) {
      set({ status: 'signedOut', lastServer });
      return;
    }
    const s = JSON.parse(raw) as StoredSession;
    set({
      status: 'signedIn',
      credentials: { server: s.server, apiKey: s.apiKey, apiSecret: s.apiSecret },
      user: s.user,
      fullName: s.fullName,
      hasProfile: s.hasProfile,
      lastServer,
    });
  },

  async signIn(serverInput, usr, pwd) {
    const server = normalizeServer(serverInput);
    const res = await api.signIn(server, usr.trim(), pwd);
    const session: StoredSession = {
      server,
      apiKey: res.api_key,
      apiSecret: res.api_secret,
      user: res.user,
      fullName: res.full_name,
      hasProfile: res.has_profile,
    };
    await persist(session);
    await SecureStore.setItemAsync('liftlog.lastServer', server);
    set({
      status: 'signedIn',
      credentials: { server, apiKey: res.api_key, apiSecret: res.api_secret },
      user: res.user,
      fullName: res.full_name,
      hasProfile: res.has_profile,
      lastServer: server,
    });
  },

  async setHasProfile(hasProfile) {
    const { credentials, user, fullName } = get();
    if (!credentials || !user) return;
    await persist({ ...credentials, user, fullName: fullName ?? user, hasProfile });
    set({ hasProfile });
  },

  async signOut() {
    const { credentials } = get();
    if (credentials) {
      // Best effort: rotate the secret on the server so this token stops working.
      await api.signOut(credentials).catch(() => undefined);
    }
    await persist(null);
    // Reminders belong to the account that set them.
    await cancelReminders().catch(() => undefined);
    await clearLocalData();
    queryClient.clear();
    set({ status: 'signedOut', credentials: null, user: null, fullName: null, hasProfile: false });
  },
}));
