// Local SQLite store: the sync outbox and cached server responses for offline display.
// Later milestones add tables for the offline workout and food logs as new migrations.

import * as SQLite from 'expo-sqlite';

const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS outbox (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     kind TEXT NOT NULL,
     key TEXT NOT NULL,
     payload TEXT NOT NULL,
     version INTEGER NOT NULL DEFAULT 1,
     attempts INTEGER NOT NULL DEFAULT 0,
     next_attempt_at INTEGER NOT NULL DEFAULT 0,
     last_error TEXT,
     created_at INTEGER NOT NULL,
     UNIQUE (kind, key)
   );
   CREATE TABLE IF NOT EXISTS cache (
     key TEXT PRIMARY KEY NOT NULL,
     value TEXT NOT NULL,
     updated_at INTEGER NOT NULL
   );`,
  // M3: the offline workout log. One draft per date, saved on every change.
  `CREATE TABLE IF NOT EXISTS workouts (
     date TEXT PRIMARY KEY NOT NULL,
     draft TEXT NOT NULL,
     updated_at INTEGER NOT NULL
   );`,
  // M4: food days edited on the phone. `synced` = 0 while a change waits for the server.
  `CREATE TABLE IF NOT EXISTS food_days (
     date TEXT PRIMARY KEY NOT NULL,
     day TEXT NOT NULL,
     synced INTEGER NOT NULL DEFAULT 0,
     updated_at INTEGER NOT NULL
   );`,
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('liftlog.db');
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

async function migrate(db: SQLite.SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    const sql = MIGRATIONS[version];
    await db.withTransactionAsync(async () => {
      await db.execAsync(sql);
    });
    version += 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM cache WHERE key = ?', [key]);
  return row ? (JSON.parse(row.value) as T) : null;
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO cache (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
    [key, JSON.stringify(value), Date.now()],
  );
}

export async function workoutGet<T>(date: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ draft: string }>('SELECT draft FROM workouts WHERE date = ?', [date]);
  return row ? (JSON.parse(row.draft) as T) : null;
}

export async function workoutPut(date: string, draft: unknown): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO workouts (date, draft, updated_at) VALUES (?, ?, ?) ON CONFLICT(date) DO UPDATE SET draft = excluded.draft, updated_at = excluded.updated_at',
    [date, JSON.stringify(draft), Date.now()],
  );
}

export async function workoutAll<T>(): Promise<T[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ draft: string }>('SELECT draft FROM workouts ORDER BY date DESC');
  return rows.map((r) => JSON.parse(r.draft) as T);
}

export interface LocalFoodDay<T> {
  day: T;
  synced: boolean;
}

export async function foodDayGet<T>(date: string): Promise<LocalFoodDay<T> | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ day: string; synced: number }>(
    'SELECT day, synced FROM food_days WHERE date = ?',
    [date],
  );
  return row ? { day: JSON.parse(row.day) as T, synced: !!row.synced } : null;
}

export async function foodDayPut(date: string, day: unknown, synced: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO food_days (date, day, synced, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET day = excluded.day, synced = excluded.synced, updated_at = excluded.updated_at`,
    [date, JSON.stringify(day), synced ? 1 : 0, Date.now()],
  );
}

export async function foodDaysSince<T>(date: string): Promise<T[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ day: string }>('SELECT day FROM food_days WHERE date >= ? ORDER BY date DESC', [date]);
  return rows.map((r) => JSON.parse(r.day) as T);
}

/** Wipe everything local: used on sign-out so the next account starts clean. */
export async function clearLocalData(): Promise<void> {
  const db = await getDb();
  await db.execAsync('DELETE FROM outbox; DELETE FROM cache; DELETE FROM workouts; DELETE FROM food_days;');
}
