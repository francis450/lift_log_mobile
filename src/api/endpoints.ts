import { apiCall, ApiError, Credentials, extractMessage, NetworkError } from './client';
import type {
  Checkin,
  CheckinGetResponse,
  CheckinPayload,
  EstimateResponse,
  ProgressSummary,
  FoodDay,
  Meal,
  SuggestResponse,
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

/** Photo and/or description to foods. The server allows 30 s for Claude; the phone waits a little longer. */
export function estimate(
  credentials: Credentials,
  input: { text?: string; image_base64?: string; image_mime?: string },
  signal?: AbortSignal,
) {
  return apiCall<EstimateResponse>('POST', 'ai.estimate', input, { credentials, signal, timeoutMs: 45_000 });
}

export function suggest(credentials: Credentials, date: string, meal: Meal) {
  return apiCall<SuggestResponse>('POST', 'ai.suggest', { date, meal }, { credentials, timeoutMs: 45_000 });
}

export function getCheckin(credentials: Credentials, week: number) {
  return apiCall<CheckinGetResponse>('GET', 'checkins.get', { week }, { credentials });
}

export function saveCheckin(credentials: Credentials, payload: CheckinPayload) {
  return apiCall<Checkin>('POST', 'checkins.save', payload as unknown as Record<string, unknown>, { credentials });
}

export function setCheckinPhoto(credentials: Credentials, week: number, file_url: string) {
  return apiCall<Checkin>('POST', 'checkins.set_photo', { week, file_url }, { credentials });
}

export function progressSummary(credentials: Credentials, week?: number) {
  return apiCall<ProgressSummary>('GET', 'progress.summary', week ? { week } : {}, { credentials });
}

/** Frappe's upload_file as a private attachment. Returns the file URL (/private/files/...). */
export async function uploadPrivateFile(
  credentials: Credentials,
  file: { uri: string; name: string; type: string },
  attachTo: { doctype: string; docname: string },
): Promise<string> {
  const form = new FormData();
  // React Native's FormData takes { uri, name, type } for a local file.
  form.append('file', file as unknown as Blob);
  form.append('is_private', '1');
  form.append('doctype', attachTo.doctype);
  form.append('docname', attachTo.docname);
  let response: Response;
  try {
    response = await fetch(`${credentials.server}/api/method/upload_file`, {
      method: 'POST',
      headers: { Accept: 'application/json', Authorization: `token ${credentials.apiKey}:${credentials.apiSecret}` },
      body: form,
    });
  } catch {
    throw new NetworkError();
  }
  const json = (await response.json().catch(() => null)) as { message?: { file_url?: string } } | null;
  if (!response.ok || !json?.message?.file_url) {
    throw new ApiError(extractMessage(json) ?? "The photo couldn't be uploaded. Try again.", response.status);
  }
  return json.message.file_url;
}

export function foodMonth(credentials: Credentials, month: string) {
  return apiCall<FoodMonthDay[]>('GET', 'food.month', { month }, { credentials });
}
