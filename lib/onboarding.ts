import {
  getCachedUserProfile,
  getCachedUserSettings,
  type UserProfile,
  type UserSettings,
} from './appCache';

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

export const getOnboardingCompletionState = async () => {
  const [profile, settings] = await Promise.all([
    getCachedUserProfile(),
    getCachedUserSettings(),
  ]);
  return isOnboardingComplete(profile, settings);
};
