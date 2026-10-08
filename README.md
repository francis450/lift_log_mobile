# Lift Log (Android app)

Expo SDK 57, TypeScript strict, Expo Router. Talks to the `lift_log` Frappe app (docs/04).

## Run

```bash
npm install
npx expo start            # scan the QR code with Expo Go (phone and PC on the same network)
npx expo run:android      # or a dev build on a USB-connected phone
```

Sign in with the site address (`https://dashboard.erpkenya.com`) and an ERPNext login that has the
**Lift Log User** role. Plain `http://` servers are refused.

## Checks

```bash
npm test          # Jest + React Native Testing Library
npm run lint
npm run typecheck
```

## Build an APK

```bash
npx eas-cli@latest build -p android --profile preview
```

## Layout

| Path | What |
|---|---|
| `src/app/` | Routes only (Expo Router). `(tabs)/` holds Today, Train, Food, Progress. |
| `src/components/` | The shared components from docs/02, built once. |
| `src/theme/` | Every color, font and radius. A dark theme would be a second color set here. |
| `src/api/` | Fetch client (token auth, Frappe error messages, 409 handling) and endpoint functions. |
| `src/sync/` | Offline outbox: one pending write per record, retry with backoff, 409 takes the server copy. |
| `src/db/` | SQLite: the outbox and cached responses so screens work offline. |
| `src/state/` | Zustand stores (auth with the token in SecureStore, notices) and the Query client. |
| `src/lib/` | Pure logic with unit tests: targets, dates, Today helpers, the program engine and the add-weight rule (`nextCall.ts`). |
| `src/lib/__tests__/nextCall.cases.json` | The add-weight rule's test table. The server runs a copy (`lift_log/tests/rule_cases.json`) against its Python port; change both together. |
| `src/workout/` | Workout drafts (saved on every change, resume after a kill), history merging, summaries, and the workout UI pieces. |

## Offline behaviour

Writes go through `enqueueAndSync(kind, key, payload)`. The outbox keeps one row per record, so
repeated edits collapse into the latest. It flushes on start, when the connection returns, when the
app comes to the foreground, and on a backoff timer (2 s doubling to 5 min). A 409 drops the local
write, keeps the server copy and shows "Updated from another device". A write the server rejects
as invalid is dropped with a message; a 401 keeps everything queued until the next sign-in.
Signing out clears local data, after warning if changes haven't synced.
