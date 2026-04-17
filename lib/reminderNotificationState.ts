import AsyncStorage from '@react-native-async-storage/async-storage';

export type ReminderNotificationStateType = 'feeding' | 'sleep_window';

const STORAGE_KEY_PREFIX = 'reminder_notification_state_v1';

const buildStorageKey = (
  type: ReminderNotificationStateType,
  userId?: string | null,
  babyId?: string | null
) => `${STORAGE_KEY_PREFIX}:${type}:${userId ?? 'anonymous'}:${babyId ?? 'default'}`;

export async function wasReminderNotificationHandled(
  type: ReminderNotificationStateType,
  scheduleKey: string,
  userId?: string | null,
  babyId?: string | null
): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(buildStorageKey(type, userId, babyId));
    return stored === scheduleKey;
  } catch (error) {
    console.error('Failed to load reminder notification state:', error);
    return false;
  }
}

export async function markReminderNotificationHandled(
  type: ReminderNotificationStateType,
  scheduleKey: string,
  userId?: string | null,
  babyId?: string | null
): Promise<void> {
  try {
    await AsyncStorage.setItem(buildStorageKey(type, userId, babyId), scheduleKey);
  } catch (error) {
    console.error('Failed to persist reminder notification state:', error);
  }
}
