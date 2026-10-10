import {
  getCachedUserProfile,
  getCachedUserSettings,
  type UserProfile,
  type UserSettings,
} from './appCache';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETE_KEY = 'onboarding_complete_v1';

export async function readSavedOnboardingCompletionState(userId: string): Promise<boolean> {
  try { return await AsyncStorage.getItem(`${ONBOARDING_COMPLETE_KEY}:${userId}`) === '1'; }
  catch { return false; }
}

const hasCompletedProfileBasics = (profile: UserProfile | null) => {
  return typeof profile?.first_name === 'string' && profile.first_name.trim().length > 0;
};

const hasPersistedUserSettings = (settings: UserSettings | null) => {
  if (!settings) return false;

  return Boolean(
    settings.id ||
    settings.user_id ||
    settings.updated_at ||
    settings.due_date ||
    typeof settings.is_baby_born === 'boolean'
  );
};

export const isOnboardingComplete = (
  profile: UserProfile | null,
  settings: UserSettings | null = null,
) => {
  return hasCompletedProfileBasics(profile) && hasPersistedUserSettings(settings);
};

export const getOnboardingCompletionState = async (knownUserId?: string) => {
  const [profile, settings] = await Promise.all([
    getCachedUserProfile(knownUserId),
    getCachedUserSettings(knownUserId),
  ]);
  const isComplete = isOnboardingComplete(profile, settings);
  if (!knownUserId) return isComplete;

  const key = `${ONBOARDING_COMPLETE_KEY}:${knownUserId}`;
  if (isComplete) {
    // The short-lived profile/settings caches can both be unavailable on an
    // offline cold start. Remember a previously verified completion locally.
    try { await AsyncStorage.setItem(key, '1'); } catch { /* non-blocking */ }
    return true;
  }
  if (profile && settings) {
    // Both records were resolved and actually say onboarding is incomplete.
    try { await AsyncStorage.removeItem(key); } catch { /* non-blocking */ }
    return false;
  }
  return readSavedOnboardingCompletionState(knownUserId);
};
