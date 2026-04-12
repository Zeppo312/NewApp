import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_PROFILE_KEY_PREFIX = 'local_profile_name';

type LocalProfileName = {
  firstName: string;
  lastName: string;
  updatedAt: string;
};

const buildKey = (userId: string) => `${LOCAL_PROFILE_KEY_PREFIX}_${userId}`;

export const getLocalProfileName = async (
  userId?: string,
): Promise<LocalProfileName | null> => {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(buildKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as LocalProfileName;
  } catch (error) {
    console.warn('Failed to load local profile name:', error);
    return null;
  }
};

export const setLocalProfileName = async (
  userId: string,
  firstName: string,
  lastName: string,
): Promise<void> => {
  if (!userId) return;
  const payload: LocalProfileName = {
    firstName: (firstName ?? '').trim(),
    lastName: (lastName ?? '').trim(),
    updatedAt: new Date().toISOString(),
  };
  try {
    await AsyncStorage.setItem(buildKey(userId), JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to store local profile name:', error);
  }
};

export const clearLocalProfileName = async (userId?: string): Promise<void> => {
  if (!userId) return;
  try {
    await AsyncStorage.removeItem(buildKey(userId));
  } catch (error) {
    console.warn('Failed to clear local profile name:', error);
  }
};
