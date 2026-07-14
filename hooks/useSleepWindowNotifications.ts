import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import type { SleepWindowPrediction } from '@/lib/sleep-window';

const NOTIFICATION_IDENTIFIER = 'sleep-window-reminder';

/**
 * Hook for managing sleep window reminder notifications
 *
 * Automatically schedules a notification 15 minutes before the predicted sleep window
 * Cancels previous notifications when prediction updates
 * Only schedules if prediction confidence is above 0.6
 *
 * Usage:
 * ```typescript
 * const { scheduleSleepReminder, cancelSleepReminder } = useSleepWindowNotifications(sleepPrediction);
 * ```
 */
export function useSleepWindowNotifications(
  sleepPrediction: SleepWindowPrediction | null
) {
  const lastScheduledRef = useRef<string | null>(null);

  useEffect(() => {
    // Cancel existing notifications if no prediction or low confidence
    if (!sleepPrediction || sleepPrediction.confidence < 0.6) {
      Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDENTIFIER);
      lastScheduledRef.current = null;
      return;
    }

    const recommendedStart = new Date(sleepPrediction.recommendedStart);
    const fifteenMinBefore = new Date(recommendedStart.getTime() - 15 * 60 * 1000);
    const now = new Date();

    // Only schedule if the time is in the future
    if (fifteenMinBefore <= now) {
      console.log('⏰ Sleep window is too soon to schedule reminder');
      return;
    }

    // Check if we already scheduled for this time
    const scheduleKey = recommendedStart.toISOString();
    if (lastScheduledRef.current === scheduleKey) {
      console.log('⏰ Sleep window reminder already scheduled for this time');
      return;
    }

    // Cancel previous notification
    Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDENTIFIER);

    // Format time for notification body
    const timeString = recommendedStart.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Schedule new notification
    Notifications.scheduleNotificationAsync({
      content: {
        title: '💤 Schlaffenster beginnt bald',
        body: `In 15 Minuten beginnt das vorhergesagte Schlaffenster (${timeString})`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: {
          type: 'sleep_window_reminder',
          recommendedStart: recommendedStart.toISOString(),
          confidence: sleepPrediction.confidence,
        },
      },
      identifier: NOTIFICATION_IDENTIFIER,
      trigger: {
        date: fifteenMinBefore,
      },
    }).then(() => {
      lastScheduledRef.current = scheduleKey;
      console.log('✅ Sleep window reminder scheduled for', fifteenMinBefore.toLocaleTimeString('de-DE'));
      console.log('   Sleep window starts at:', timeString);
      console.log('   Confidence:', sleepPrediction.confidence);
    }).catch((error) => {
      console.error('Failed to schedule sleep window reminder:', error);
    });

  }, [sleepPrediction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDENTIFIER);
    };
  }, []);

  /**
   * Manually schedule a sleep reminder
   * (Usually not needed as the hook schedules automatically)
   */
  const scheduleSleepReminder = () => {
    // Trigger effect by updating ref
    lastScheduledRef.current = null;
  };

  /**
   * Cancel the sleep reminder
   */
  const cancelSleepReminder = () => {
    Notifications.cancelScheduledNotificationAsync(NOTIFICATION_IDENTIFIER);
    lastScheduledRef.current = null;
    console.log('✅ Sleep window reminder cancelled');
  };

  return {
    scheduleSleepReminder,
    cancelSleepReminder,
  };
}
