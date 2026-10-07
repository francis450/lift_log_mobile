import { getDb } from '@/db/database';

import { mergePayload, OutboxItem, OutboxKind, OutboxStore } from './queue';

interface Row {
  id: number;
  kind: OutboxKind;
  key: string;
  payload: string;
  version: number;
  attempts: number;
  next_attempt_at: number;
  last_error: string | null;
}

function toItem(row: Row): OutboxItem {
  return {
    id: row.id,
    kind: row.kind,
    key: row.key,
    payload: JSON.parse(row.payload),
    version: row.version,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    lastError: row.last_error,
  };
}

export const sqliteOutbox: OutboxStore = {
  async put(kind, key, payload, merge) {
    const db = await getDb();
    await db.withExclusiveTransactionAsync(async (tx) => {
      let value = payload;
      if (merge) {
        const existing = await tx.getFirstAsync<{ payload: string }>(
          'SELECT payload FROM outbox WHERE kind = ? AND key = ?',
          [kind, key],
        );
        if (existing) value = mergePayload(JSON.parse(existing.payload), payload);
      }
      await tx.runAsync(
        `INSERT INTO outbox (kind, key, payload, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT(kind, key) DO UPDATE SET payload = excluded.payload, version = version + 1,
           attempts = 0, next_attempt_at = 0, last_error = NULL`,
        [kind, key, JSON.stringify(value), Date.now()],
      );
    });
  },
  async due(now) {
    const db = await getDb();
    const rows = await db.getAllAsync<Row>('SELECT * FROM outbox WHERE next_attempt_at <= ? ORDER BY id', [now]);
    return rows.map(toItem);
  },
  async remove(id, version) {
    const db = await getDb();
    await db.runAsync('DELETE FROM outbox WHERE id = ? AND version = ?', [id, version]);
  },
  async reschedule(id, version, attempts, nextAttemptAt, lastError) {
    const db = await getDb();
    await db.runAsync(
      'UPDATE outbox SET attempts = ?, next_attempt_at = ?, last_error = ? WHERE id = ? AND version = ?',
      [attempts, nextAttemptAt, lastError, id, version],
    );
  },
  async count() {
    const db = await getDb();
    const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox');
    return row?.n ?? 0;
  },
  async nextAttemptAt() {
    const db = await getDb();
    const row = await db.getFirstAsync<{ t: number | null }>('SELECT MIN(next_attempt_at) AS t FROM outbox');
    return row?.t ?? null;
  },
};
