import { ApiError, ConflictError, NetworkError } from '@/api/client';

import { backoffMs, createMemoryOutbox, createSyncQueue, OutboxItem } from '../queue';

function setup(send: (item: OutboxItem) => Promise<void>) {
  let now = 1_000_000;
  const store = createMemoryOutbox();
  const events = { onConflict: jest.fn(), onDropped: jest.fn(), onAuthExpired: jest.fn() };
  const queue = createSyncQueue({ store, send, events, now: () => now });
  return { queue, store, events, advance: (ms: number) => (now += ms) };
}

describe('sync queue', () => {
  it('sends queued writes and removes them', async () => {
    const send = jest.fn(async () => undefined);
    const { queue } = setup(send);
    await queue.enqueue('session', '2026-10-06', { a: 1 });
    expect(await queue.flush()).toEqual({ sent: 1, conflicts: 0, retrying: 0, dropped: 0 });
    expect(await queue.pending()).toBe(0);
  });

  it('keeps one pending write per record (latest wins)', async () => {
    const send = jest.fn(async () => undefined);
    const { queue } = setup(send);
    await queue.enqueue('food_day', '2026-10-07', { entries: 1 });
    await queue.enqueue('food_day', '2026-10-07', { entries: 2 });
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect((send.mock.calls[0] as unknown as [OutboxItem])[0].payload).toEqual({ entries: 2 });
  });

  it('merges partial profile updates', async () => {
    const send = jest.fn(async () => undefined);
    const { queue } = setup(send);
    await queue.enqueue('profile', 'me', { height_cm: 175 }, true);
    await queue.enqueue('profile', 'me', { age: 25 }, true);
    await queue.flush();
    expect((send.mock.calls[0] as unknown as [OutboxItem])[0].payload).toEqual({ height_cm: 175, age: 25 });
  });

  it('retries with backoff when offline, and stops the run', async () => {
    const send = jest.fn<Promise<void>, [OutboxItem]>(async () => {
      throw new NetworkError();
    });
    const { queue, store, advance } = setup(send);
    await queue.enqueue('session', 'a', {});
    await queue.enqueue('session', 'b', {});
    expect(await queue.flush()).toMatchObject({ retrying: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(store.items[0]).toMatchObject({ attempts: 1, nextAttemptAt: 1_000_000 + 2_000 });

    // "a" isn't due again yet; only "b", which was never tried, is sent.
    send.mockClear();
    advance(1_000);
    await queue.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].key).toBe('b');

    send.mockImplementation(async () => undefined);
    advance(5_000);
    await queue.flush();
    expect(await queue.pending()).toBe(0);
  });

  it('backs off 2 s, 4 s, 8 s up to 5 min', () => {
    expect([1, 2, 3].map(backoffMs)).toEqual([2_000, 4_000, 8_000]);
    expect(backoffMs(20)).toBe(300_000);
  });

  it('on 409 takes the server copy and drops the local write', async () => {
    const stored = { session_date: '2026-10-06', note: 'newer' };
    const { queue, events } = setup(async () => {
      throw new ConflictError(stored);
    });
    await queue.enqueue('session', '2026-10-06', { note: 'older' });
    expect(await queue.flush()).toMatchObject({ conflicts: 1 });
    expect(events.onConflict).toHaveBeenCalledWith(expect.objectContaining({ key: '2026-10-06' }), stored);
    expect(await queue.pending()).toBe(0);
  });

  it('drops writes the server rejects as invalid', async () => {
    const { queue, events } = setup(async () => {
      throw new ApiError('Invalid meal: brunch', 417);
    });
    await queue.enqueue('food_day', '2026-10-07', {});
    expect(await queue.flush()).toMatchObject({ dropped: 1 });
    expect(events.onDropped).toHaveBeenCalled();
  });

  it('keeps writes when the sign-in has expired', async () => {
    const { queue, events } = setup(async () => {
      throw new ApiError('Expired', 401);
    });
    await queue.enqueue('session', 'a', {});
    await queue.flush();
    expect(events.onAuthExpired).toHaveBeenCalled();
    expect(await queue.pending()).toBe(1);
  });

  it('does not lose a newer write made while the older one was sending', async () => {
    let queueRef: ReturnType<typeof createSyncQueue> | null = null;
    const sent: unknown[] = [];
    const send = jest.fn(async (item: OutboxItem) => {
      sent.push(item.payload);
      if (sent.length === 1) await queueRef!.enqueue('session', 'a', { v: 2 });
    });
    const { queue } = setup(send);
    queueRef = queue;
    await queue.enqueue('session', 'a', { v: 1 });
    await queue.flush();
    expect(await queue.pending()).toBe(1);
    await queue.flush();
    expect(sent).toEqual([{ v: 1 }, { v: 2 }]);
    expect(await queue.pending()).toBe(0);
  });

  it('shares one run between concurrent flushes', async () => {
    const send = jest.fn(async () => undefined);
    const { queue } = setup(send);
    await queue.enqueue('session', 'a', {});
    await Promise.all([queue.flush(), queue.flush()]);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
