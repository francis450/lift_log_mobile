import { useMutation, useQuery } from '@tanstack/react-query';

import { NetworkError } from '@/api/client';
import * as api from '@/api/endpoints';
import type { Profile, ProfileUpdate, TodayResponse } from '@/api/types';
import { cacheGet, cacheSet } from '@/db/database';
import { DEFAULT_TZ, todayIn } from '@/lib/dates';
import { applyProfileUpdate } from '@/lib/profile';
import { useAuth } from '@/state/auth';
import { queryClient } from '@/state/queryClient';
import { enqueueAndSync } from '@/sync';

/** Fetch from the server and cache the result; offline, serve the last cached copy. */
async function fetchCached<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
  try {
    const data = await fetcher();
    await cacheSet(cacheKey, data);
    return data;
  } catch (error) {
    if (error instanceof NetworkError) {
      const cached = await cacheGet<T>(cacheKey);
      if (cached) return cached;
    }
    throw error;
  }
}

export function useProfile() {
  const credentials = useAuth((s) => s.credentials);
  return useQuery({
    queryKey: ['profile'],
    enabled: !!credentials,
    queryFn: () => fetchCached('profile', () => api.getProfile(credentials!)),
  });
}

export function useTimeZone(): string {
  return useProfile().data?.time_zone ?? DEFAULT_TZ;
}

export function useToday(date?: string) {
  const credentials = useAuth((s) => s.credentials);
  const tz = useTimeZone();
  const day = date ?? todayIn(tz);
  return useQuery({
    queryKey: ['today', day],
    enabled: !!credentials,
    queryFn: () => fetchCached<TodayResponse>(`today:${day}`, () => api.getToday(credentials!, day)),
  });
}

/** Save profile changes. Online: straight to the server. Offline: applied locally and queued. */
export function useSaveProfile() {
  const credentials = useAuth((s) => s.credentials);
  return useMutation({
    mutationFn: async (update: ProfileUpdate): Promise<Profile> => {
      try {
        return await api.saveProfile(credentials!, update);
      } catch (error) {
        if (!(error instanceof NetworkError)) throw error;
        await enqueueAndSync('profile', 'me', update, true);
        const current = queryClient.getQueryData<Profile>(['profile']);
        if (!current) throw error;
        return applyProfileUpdate(current, update);
      }
    },
    onSuccess: async (profile) => {
      queryClient.setQueryData(['profile'], profile);
      await cacheSet('profile', profile);
      await queryClient.invalidateQueries({ queryKey: ['today'] });
    },
  });
}
