import { apiCall, Credentials } from './client';
import type {
  FoodDay,
  FoodItem,
  FoodMonthDay,
  FoodSearchResult,
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

export function getFoodDay(credentials: Credentials, date: string) {
  return apiCall<FoodDay>('GET', 'food.get_day', { date }, { credentials });
}

export function saveFoodDay(credentials: Credentials, day: FoodDay) {
  return apiCall<FoodDay>('POST', 'food.save_day', day as unknown as Record<string, unknown>, { credentials });
}

export function foodSearch(credentials: Credentials, q = '', limit = 100) {
  return apiCall<FoodSearchResult>('GET', 'food.search', { q, limit }, { credentials });
}

export function saveFoodItem(credentials: Credentials, item: Omit<FoodItem, 'name'>) {
  return apiCall<FoodItem>('POST', 'food.save_item', item, { credentials });
}

export function foodMonth(credentials: Credentials, month: string) {
  return apiCall<FoodMonthDay[]>('GET', 'food.month', { month }, { credentials });
}
