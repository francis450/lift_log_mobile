// Local reminders on the phone (expo-notifications). Every sync cancels this app's scheduled
// reminders and schedules the current plan, so switching one off in Settings cancels it.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { FoodDay, Profile } from '@/api/types';
import { cacheGet, foodDayGet, LocalFoodDay } from '@/db/database';
import { localKey, serverKey } from '@/food/store';
import { DEFAULT_TZ, todayIn } from '@/lib/dates';
import { isOurs, planReminders, PlannedReminder } from '@/lib/reminders';
import { queryClient } from '@/state/queryClient';

export const CHANNEL_ID = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** The parts of expo-notifications used here (tests pass a fake). */
export interface Scheduler {
  getAllScheduledNotificationsAsync(): Promise<{ identifier: string }[]>;
  cancelScheduledNotificationAsync(identifier: string): Promise<void>;
  scheduleNotificationAsync(request: Notifications.NotificationRequestInput): Promise<string>;
}

export async function applyReminders(plan: PlannedReminder[], scheduler: Scheduler = Notifications): Promise<void> {
  const scheduled = await scheduler.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((n) => isOurs(n.identifier)).map((n) => scheduler.cancelScheduledNotificationAsync(n.identifier)),
  );
  for (const item of plan) {
    await scheduler.scheduleNotificationAsync({
      identifier: item.id,
      content: { title: item.title, body: item.body, data: { url: item.url } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.at, channelId: CHANNEL_ID },
    });
  }
}

export async function cancelReminders(): Promise<void> {
  await applyReminders([]);
}

async function dinnerLoggedToday(today: string): Promise<boolean> {
  const local =
    queryClient.getQueryData<LocalFoodDay<FoodDay> | null>(localKey(today)) ?? (await foodDayGet<FoodDay>(today));
  const server = queryClient.getQueryData<FoodDay | null>(serverKey(today)) ?? (await cacheGet<FoodDay>(`food-day:${today}`));
  const day = local && !local.synced ? local.day : (server ?? local?.day);
  return !!day?.entries.some((e) => e.meal === 'dinner');
}

let running: Promise<void> | null = null;

/** Recompute and reschedule from the cached profile and today's food. Safe to call often. */
export function syncReminders(): Promise<void> {
  running ??= (async () => {
    try {
      const profile = queryClient.getQueryData<Profile>(['profile']) ?? (await cacheGet<Profile>('profile'));
      if (!profile?.exists) return;
      const reminders = profile.reminders;
      const wanted = reminders.workout || reminders.dinner || reminders.checkin;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: 'Reminders',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }
      let granted = (await Notifications.getPermissionsAsync()).granted;
      if (!granted && wanted) granted = (await Notifications.requestPermissionsAsync()).granted;
      if (!granted) return;

      const tz = profile.time_zone || DEFAULT_TZ;
      const today = todayIn(tz);
      const dinnerToday = await dinnerLoggedToday(today);
      await applyReminders(
        planReminders({
          program: profile.program,
          today,
          now: new Date(),
          timeZone: tz,
          sessionTime: profile.session_time ?? '18:00',
          reminders,
          dinnerLogged: (date) => date === today && dinnerToday,
        }),
      );
    } catch {
      // Reminders are best effort; never break the screen that triggered a sync.
    } finally {
      running = null;
    }
  })();
  return running;
}
