import { useEffect, useCallback, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { savePushToken } from '@/lib/notificationService';

/**
 * Core notification hook for managing notification permissions and listeners
 *
 * Features:
 * - Request notification permissions
 * - Setup notification listeners
 * - Schedule notifications
 * - Handle notification navigation
 * - Cleanup on unmount
 *
 * Usage:
 * ```typescript
 * const { requestPermissions, scheduleNotification, hasPermission } = useNotifications();
 *
 * useEffect(() => {
 *   requestPermissions();
 * }, []);
 * ```
 */
export function useNotifications() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  /**
   * Request notification permissions from the user
   * Sets up notification channels on Android
   * Registers for push notifications and saves token
   */
  const requestPermissions = useCallback(async () => {
    try {
      // Only request on physical devices
      if (!Device.isDevice) {
        console.log('Notifications require a physical device');
        setHasPermission(false);
        return false;
      }

      // Check current permission status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permission if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      // Update permission state
      const granted = finalStatus === 'granted';
      setHasPermission(granted);

      if (!granted) {
        console.log('Notification permission not granted');
        return false;
      }

      // Setup Android notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#8E4EC6',
          sound: 'default',
        });
      }

      // Get Expo push token
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: Constants.expoConfig?.extra?.eas?.projectId,
        });
        setExpoPushToken(tokenData.data);

        // Save token to database
        await savePushToken(tokenData.data);
        console.log('✅ Push token registered:', tokenData.data);
      } catch (error) {
        console.error('Failed to get push token:', error);
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      setHasPermission(false);
      return false;
    }
  }, []);

  /**
   * Schedule a local notification
   *
   * @param title - Notification title
   * @param body - Notification body text
   * @param data - Additional data to pass to notification
   * @param trigger - When to trigger the notification (null = immediate)
   * @param identifier - Unique identifier for the notification
   */
  const scheduleNotification = useCallback(async (
    title: string,
    body: string,
    data?: Record<string, any>,
    trigger?: Notifications.NotificationTriggerInput | null,
    identifier?: string
  ) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: data || {},
        },
        trigger: trigger || null,
        identifier,
      });
      console.log('✅ Notification scheduled:', title);
    } catch (error) {
      console.error('Failed to schedule notification:', error);
    }
  }, []);

  /**
   * Cancel a scheduled notification by identifier
   */
  const cancelNotification = useCallback(async (identifier: string) => {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
      console.log('✅ Notification cancelled:', identifier);
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }, []);

  /**
   * Cancel all scheduled notifications
   */
  const cancelAllNotifications = useCallback(async () => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('✅ All notifications cancelled');
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
    }
  }, []);

  /**
   * Get all scheduled notifications
   */
  const getScheduledNotifications = useCallback(async () => {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      return notifications;
    } catch (error) {
      console.error('Failed to get scheduled notifications:', error);
      return [];
    }
  }, []);

  /**
   * Handle navigation based on notification type
   */
  const handleNotificationNavigation = useCallback((notification: Notifications.Notification) => {
    const data = notification.request.content.data as any;
    const type = data?.type as string;
    const referenceId = data?.referenceId as string;

    console.log('📱 Handling notification navigation:', { type, referenceId });

    try {
      switch (type) {
        case 'sleep_window_reminder':
          router.push('/(tabs)/sleep-tracker' as any);
          break;

        case 'feeding_reminder':
          router.push('/(tabs)/home' as any);
          break;

        case 'partner_sleep':
          router.push({
            pathname: '/(tabs)/sleep-tracker',
            params: referenceId ? { entryId: referenceId } : {}
          } as any);
          break;

        case 'partner_feeding':
        case 'partner_diaper':
          router.push({
            pathname: '/(tabs)/daily_old',
            params: referenceId ? { entryId: referenceId } : {}
          } as any);
          break;

        default:
          console.log('Unknown notification type:', type);
      }
    } catch (error) {
      console.error('Error navigating from notification:', error);
    }
  }, []);

  // Setup notification listeners on mount
  useEffect(() => {
    // Listener for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📱 Notification received in foreground:', notification);
      // Notification is automatically displayed by the system
    });

    // Listener for user tapping on notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📱 User tapped notification:', response);
      handleNotificationNavigation(response.notification);
    });

    // Cleanup on unmount
    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [handleNotificationNavigation]);

  return {
    hasPermission,
    expoPushToken,
    requestPermissions,
    scheduleNotification,
    cancelNotification,
    cancelAllNotifications,
    getScheduledNotifications,
  };
}
