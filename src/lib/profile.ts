import type { Profile, ProfileUpdate } from '@/api/types';

import { kcalTarget, proteinTarget } from './targets';

/** Apply an update to a cached profile the way the server would, for a save made offline. */
export function applyProfileUpdate(profile: Profile, update: ProfileUpdate): Profile {
  const next = { ...profile, ...update } as Profile;
  // Sending a target sets it to manual unless the same update sends its _manual flag.
  if ('kcal_target' in update) next.kcal_target_manual = !('kcal_target_manual' in update) || !!update.kcal_target_manual;
  else if ('kcal_target_manual' in update) next.kcal_target_manual = !!update.kcal_target_manual;
  if ('protein_target_g' in update)
    next.protein_target_manual = !('protein_target_manual' in update) || !!update.protein_target_manual;
  else if ('protein_target_manual' in update) next.protein_target_manual = !!update.protein_target_manual;
  if ('ai_enabled' in update) next.ai_enabled = !!update.ai_enabled;
  if (!next.kcal_target_manual) next.kcal_target = kcalTarget(next.weight_kg, next.height_cm, next.age);
  if (!next.protein_target_manual) next.protein_target_g = proteinTarget(next.weight_kg);
  return next;
}
