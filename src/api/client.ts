// Thin fetch wrapper for /api/method/lift_log.api.*: token auth, timeouts and Frappe error messages.

export interface Credentials {
  server: string;
  apiKey: string;
  apiSecret: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** HTTP 409 from an upsert: the server has a newer copy. */
export class ConflictError<T = unknown> extends ApiError {
  constructor(readonly stored: T) {
    super('Updated from another device', 409);
    this.name = 'ConflictError';
  }
}

export class NetworkError extends Error {
  constructor(message = "Can't reach the server. Check the address and your connection.") {
    super(message);
    this.name = 'NetworkError';
  }
}

const TIMEOUT_MS = 20_000;

/** Trim, drop trailing slashes, and insist on https (the app refuses plain http). */
export function normalizeServer(input: string): string {
  const server = input.trim().replace(/\/+$/, '');
  if (!/^https:\/\/[^\s/]+\.[^\s/]+/i.test(server)) {
    throw new ApiError('Enter the full server address, starting with https://', 0);
  }
  return server;
}

function stripHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

/** The human message from a Frappe error body: _server_messages, then message, then exception. */
export function extractMessage(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  if (typeof b._server_messages === 'string') {
    try {
      const list = JSON.parse(b._server_messages) as string[];
      const messages = list
        .map((raw) => {
          try {
            const parsed = JSON.parse(raw) as { message?: string };
            return parsed.message ?? raw;
          } catch {
            return raw;
          }
        })
        .map(stripHtml)
        .filter(Boolean);
      if (messages.length) return messages.join('\n');
    } catch {
      // fall through
    }
  }
  if (typeof b.message === 'string' && b.message) return stripHtml(b.message);
  if (typeof b.exception === 'string') {
    const text = b.exception.split(':').slice(1).join(':').trim();
    if (text) return stripHtml(text);
  }
  return null;
}

function fallbackMessage(status: number): string {
  if (status === 401) return 'Your sign-in has expired. Sign in again.';
  if (status === 403) return "You don't have access to this.";
  if (status === 404) return "This server doesn't have Lift Log installed.";
  if (status === 429) return 'Too many requests. Try again later.';
  if (status >= 500) return 'The server had a problem. Try again.';
  return 'Something went wrong. Try again.';
}

type Params = Record<string, unknown>;

export interface CallOptions {
  credentials?: Credentials | null;
  server?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/** Call lift_log.api.<path>. Resolves to the `message` value; throws ApiError, ConflictError or NetworkError. */
export async function apiCall<T>(
  method: 'GET' | 'POST',
  path: string,
  params: Params = {},
  options: CallOptions = {},
): Promise<T> {
  const server = options.credentials?.server ?? options.server;
  if (!server) throw new ApiError('Not signed in.', 401);

  let url = `${server}/api/method/lift_log.api.${path}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.credentials) {
    headers.Authorization = `token ${options.credentials.apiKey}:${options.credentials.apiSecret}`;
  }
  let body: string | undefined;
  if (method === 'GET') {
    const query = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (query) url += `?${query}`;
  } else {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(params);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TIMEOUT_MS);
  options.signal?.addEventListener('abort', () => controller.abort());

  let response: Response;
  try {
    response = await fetch(url, { method, headers, body, signal: controller.signal });
  } catch {
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (response.status === 409) {
    const message = (json as { message?: { stored?: unknown } } | null)?.message;
    throw new ConflictError(message?.stored ?? null);
  }
  if (!response.ok) {
    throw new ApiError(extractMessage(json) ?? fallbackMessage(response.status), response.status);
  }
  return (json as { message: T }).message;
}
