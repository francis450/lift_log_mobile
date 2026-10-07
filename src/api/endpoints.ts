import { apiCall, Credentials } from './client';
import type { Profile, ProfileUpdate, SignInResponse, TodayResponse } from './types';

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
