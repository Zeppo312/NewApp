import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import type { ExpoPushToken, ExpoPushTokenOptions } from 'expo-notifications';

// SDK 57's package entry point eagerly starts push-token registration, which
// throws in Android Expo Go. Import local APIs directly so reminders still work.
// Keep these SDK-specific paths together and verify them when upgrading Expo.
export { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
export { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
export {
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from 'expo-notifications/build/NotificationsEmitter';
export { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
export { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync';
export { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
export { cancelAllScheduledNotificationsAsync } from 'expo-notifications/build/cancelAllScheduledNotificationsAsync';
export { dismissNotificationAsync } from 'expo-notifications/build/dismissNotificationAsync';
export { dismissAllNotificationsAsync } from 'expo-notifications/build/dismissAllNotificationsAsync';
export { setNotificationCategoryAsync } from 'expo-notifications/build/setNotificationCategoryAsync';
export { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
export { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
export {
  AndroidNotificationPriority,
  SchedulableTriggerInputTypes,
} from 'expo-notifications/build/Notifications.types';
export type {
  EventSubscription,
  Notification,
  NotificationRequest,
  NotificationTriggerInput,
} from 'expo-notifications';

export function supportsRemoteNotifications(): boolean {
  return Platform.OS !== 'web' && !(Platform.OS === 'android' && isRunningInExpoGo());
}

export async function getExpoPushTokenAsync(
  options?: ExpoPushTokenOptions,
): Promise<ExpoPushToken | null> {
  if (!supportsRemoteNotifications()) return null;

  // Load the push module only in runtimes that support it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const notifications = require('expo-notifications') as typeof import('expo-notifications');
  return notifications.getExpoPushTokenAsync(options);
}
