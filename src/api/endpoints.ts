import { apiCall, Credentials } from './client';
import type {
  FoodMonthDay,
  HistoryItem,
  MonthSession,
  Profile,
  ProfileUpdate,
  Session,
  SessionPayload,
  SignInResponse,
  TodayResponse,
} from './types';

export function signIn(server: string, usr: string, pwd: string) {
  return apiCall<SignInResponse>('POST', 'auth.sign_in', { usr, pwd }, { server });
}

export function signOut(credentials: Credentials) {
  return apiCall<{ ok: boolean }>('POST', 'auth.sign_out', {}, { credentials, timeoutMs: 8_000 });
}

export function getProfile(credentials: Credentials) {
  return apiCall<Profile>('GET', 'profile.get', {}, { credentials });
}

export function saveProfile(credentials: Credentials, update: ProfileUpdate) {
  return apiCall<Profile>('POST', 'profile.save', update, { credentials });
}

export function getToday(credentials: Credentials, date: string) {
  return apiCall<TodayResponse>('GET', 'today.get', { date }, { credentials });
}

export function getSession(credentials: Credentials, date: string) {
  return apiCall<Session | null>('GET', 'sessions.get', { date }, { credentials });
}

export function saveSession(credentials: Credentials, payload: SessionPayload) {
  return apiCall<Session>('POST', 'sessions.save', payload as unknown as Record<string, unknown>, { credentials });
}

export function sessionHistory(credentials: Credentials, exercise: string, limit = 6) {
  return apiCall<HistoryItem[]>('GET', 'sessions.history', { exercise, limit }, { credentials });
}

export function sessionsMonth(credentials: Credentials, month: string) {
  return apiCall<MonthSession[]>('GET', 'sessions.month', { month }, { credentials });
}

export function foodMonth(credentials: Credentials, month: string) {
  return apiCall<FoodMonthDay[]>('GET', 'food.month', { month }, { credentials });
}
