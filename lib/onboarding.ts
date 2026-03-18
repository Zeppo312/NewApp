import { getCachedUserProfile, type UserProfile } from './appCache';

export const isOnboardingComplete = (profile: UserProfile | null) => {
  return typeof profile?.first_name === 'string' && profile.first_name.trim().length > 0;
};

export const getOnboardingCompletionState = async () => {
  const profile = await getCachedUserProfile();
  return isOnboardingComplete(profile);
};
