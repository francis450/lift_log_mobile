// Offline sync queue. Every write lands here first; flush() sends it when the server is reachable.
// Storage and transport are injected so the engine is testable without SQLite or a network.

import { ApiError, ConflictError, NetworkError } from '@/api/client';

export type OutboxKind = 'profile' | 'session' | 'food_day' | 'food_item' | 'checkin';

export interface OutboxItem {
  id: number;
  kind: OutboxKind;
  /** One pending item per (kind, key): later writes replace (or merge into) the payload. */
  key: string;
  payload: unknown;
  /** Bumped on every replace, so a send that raced with a newer write doesn't delete it. */
  version: number;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
}

export interface OutboxStore {
  put(kind: OutboxKind, key: string, payload: unknown, merge: boolean): Promise<void>;
  due(now: number): Promise<OutboxItem[]>;
  remove(id: number, version: number): Promise<void>;
  reschedule(id: number, version: number, attempts: number, nextAttemptAt: number, lastError: string): Promise<void>;
  count(): Promise<number>;
  nextAttemptAt(): Promise<number | null>;
}

export interface QueueEvents {
  /** HTTP 409: the server copy wins. Store it locally and tell the user. */
  onConflict?: (item: OutboxItem, stored: unknown) => Promise<void> | void;
  /** The server rejected the write as invalid; it will never succeed, so it is dropped. */
  onDropped?: (item: OutboxItem, error: Error) => void;
  /** HTTP 401: the token no longer works. Items stay queued until the user signs in again. */
  onAuthExpired?: () => void;
  onChange?: () => void;
}

export interface FlushResult {
  sent: number;
  conflicts: number;
  retrying: number;
  dropped: number;
}

const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5 * 60_000;

/** 2 s, 4 s, 8 s ... capped at 5 min. */
export function backoffMs(attempts: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** Math.max(attempts - 1, 0), MAX_DELAY_MS);
}

function isRetryable(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  return error instanceof ApiError && (error.status >= 500 || error.status === 429 || error.status === 408);
}

export function createSyncQueue(options: {
  store: OutboxStore;
  send: (item: OutboxItem) => Promise<void>;
  events?: QueueEvents;
  now?: () => number;
}) {
  const { store, send, events = {}, now = Date.now } = options;
  let running: Promise<FlushResult> | null = null;

  async function enqueue(kind: OutboxKind, key: string, payload: unknown, merge = false) {
    await store.put(kind, key, payload, merge);
    events.onChange?.();
  }

  async function runFlush(): Promise<FlushResult> {
    const result: FlushResult = { sent: 0, conflicts: 0, retrying: 0, dropped: 0 };
    const items = await store.due(now());
    for (const item of items) {
      try {
        await send(item);
        await store.remove(item.id, item.version);
        result.sent += 1;
      } catch (error) {
        if (error instanceof ConflictError) {
          await events.onConflict?.(item, error.stored);
          await store.remove(item.id, item.version);
          result.conflicts += 1;
        } else if (isRetryable(error)) {
          const attempts = item.attempts + 1;
          await store.reschedule(item.id, item.version, attempts, now() + backoffMs(attempts), (error as Error).message);
          result.retrying += 1;
          // Offline: the rest would fail the same way.
          if (error instanceof NetworkError) break;
        } else if (error instanceof ApiError && error.status === 401) {
          events.onAuthExpired?.();
          break;
        } else {
          events.onDropped?.(item, error as Error);
          await store.remove(item.id, item.version);
          result.dropped += 1;
        }
      }
    }
    events.onChange?.();
    return result;
  }

  /** Send everything that is due. Concurrent calls share one run. */
  function flush(): Promise<FlushResult> {
    if (!running) {
      running = runFlush().finally(() => {
        running = null;
      });
    }
    return running;
  }

  return {
    enqueue,
    flush,
    pending: () => store.count(),
    nextAttemptAt: () => store.nextAttemptAt(),
  };
}

export type SyncQueue = ReturnType<typeof createSyncQueue>;

function mergePayload(existing: unknown, incoming: unknown): unknown {
  if (existing && incoming && typeof existing === 'object' && typeof incoming === 'object') {
    return { ...(existing as object), ...(incoming as object) };
  }
  return incoming;
}

/** In-memory OutboxStore, for tests. */
export function createMemoryOutbox(): OutboxStore & { items: OutboxItem[] } {
  const items: OutboxItem[] = [];
  let nextId = 1;
  return {
    items,
    async put(kind, key, payload, merge) {
      const existing = items.find((i) => i.kind === kind && i.key === key);
      if (existing) {
        existing.payload = merge ? mergePayload(existing.payload, payload) : payload;
        existing.version += 1;
        existing.attempts = 0;
        existing.nextAttemptAt = 0;
        existing.lastError = null;
      } else {
        items.push({ id: nextId++, kind, key, payload, version: 1, attempts: 0, nextAttemptAt: 0, lastError: null });
      }
    },
    async due(now) {
      return items.filter((i) => i.nextAttemptAt <= now).map((i) => ({ ...i }));
    },
    async remove(id, version) {
      const index = items.findIndex((i) => i.id === id && i.version === version);
      if (index >= 0) items.splice(index, 1);
    },
    async reschedule(id, version, attempts, nextAttemptAt, lastError) {
      const item = items.find((i) => i.id === id && i.version === version);
      if (item) Object.assign(item, { attempts, nextAttemptAt, lastError });
    },
    async count() {
      return items.length;
    },
    async nextAttemptAt() {
      return items.length ? Math.min(...items.map((i) => i.nextAttemptAt)) : null;
    },
  };
}

export { mergePayload };
