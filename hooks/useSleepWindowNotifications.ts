import { useCallback, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import type { SleepWindowPrediction } from '@/lib/sleep-window';
import {
  cancelBabyReminderNotification,
  upsertBabyReminderNotification,
} from '@/lib/babyReminderNotifications';
import {
  SLEEP_WINDOW_REMINDER_IDENTIFIER,
  SLEEP_WINDOW_REMINDER_TYPE,
  cancelLocalSleepWindowReminders,
} from '@/lib/sleepWindowReminderNotifications';

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
  sleepPrediction: SleepWindowPrediction | null,
  enabled: boolean = true,
  userId?: string | null,
  babyId?: string | null,
  currentDevicePushToken?: string | null,
  hasActiveSleepEntry: boolean = false
) {
  const lastScheduledRef = useRef<string | null>(null);
  const scheduledNotificationIdRef = useRef<string | null>(null);
  // Remote reminders are optional and used only for additional devices.
  // Local scheduling remains primary to work reliably while app is closed.
  const hasRemoteChannel = Boolean(userId && babyId && currentDevicePushToken);

  const cancelCurrentScheduledNotification = useCallback(async () => {
    const scheduledId = scheduledNotificationIdRef.current;
    await cancelLocalSleepWindowReminders(scheduledId ? [scheduledId] : []);

    scheduledNotificationIdRef.current = null;
  }, []);

  const cancelRemoteReminder = useCallback(async () => {
    if (!userId || !babyId) return;
    try {
      await cancelBabyReminderNotification({
        userId,
        babyId,
        reminderType: 'sleep_window',
      });
    } catch (error) {
      console.error('Failed to cancel remote sleep reminder:', error);
    }
  }, [userId, babyId]);

  const syncRemoteReminder = useCallback(
    async (scheduledFor: Date, scheduleKey: string, body: string) => {
      if (!userId || !babyId) return;
      try {
        await upsertBabyReminderNotification({
          userId,
          babyId,
          reminderType: 'sleep_window',
          scheduledFor,
          title: '💤 Schlaffenster beginnt bald',
          body,
          scheduleKey,
          payload: {
            type: SLEEP_WINDOW_REMINDER_TYPE,
            recommendedStart: scheduleKey,
            excludeToken: currentDevicePushToken,
          },
        });
      } catch (error) {
        console.error('Failed to sync remote sleep reminder:', error);
      }
    },
    [userId, babyId, currentDevicePushToken]
  );

  useEffect(() => {
    let isMounted = true;

    const syncNotification = async () => {
      // Cancel if disabled, active sleep is running, no prediction, or low confidence
      if (!enabled || hasActiveSleepEntry || !sleepPrediction || sleepPrediction.confidence < 0.6) {
        await Promise.all([
          cancelCurrentScheduledNotification(),
          cancelRemoteReminder(),
        ]);
        lastScheduledRef.current = null;
        if (hasActiveSleepEntry) {
          console.log('⏸️ Sleep window reminder skipped because an active sleep is running');
        }
        return;
      }

      const recommendedStart = new Date(sleepPrediction.recommendedStart);
      const fifteenMinBefore = new Date(recommendedStart.getTime() - 15 * 60 * 1000);
      const now = new Date();
      const scheduleKey = recommendedStart.toISOString();

      // Check if we already scheduled for this time
      if (lastScheduledRef.current === scheduleKey) {
        console.log('⏰ Sleep window reminder already scheduled for this time');
        return;
      }

      // Trigger time is already past: cancel stale reminders and optionally notify immediately
      if (fifteenMinBefore <= now) {
        await Promise.all([
          cancelCurrentScheduledNotification(),
          cancelRemoteReminder(),
        ]);

        const msUntilStart = recommendedStart.getTime() - now.getTime();
        const shouldSendImmediate = msUntilStart > 0 && msUntilStart <= 15 * 60 * 1000;

        if (shouldSendImmediate) {
          const minutesUntilStart = Math.max(1, Math.round(msUntilStart / 60000));
          const immediateBody = `Das vorhergesagte Schlaffenster startet in ca. ${minutesUntilStart} Minuten`;

          const immediateId = await Notifications.scheduleNotificationAsync({
            content: {
              title: '💤 Schlaffenster beginnt bald',
              body: immediateBody,
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
              data: {
                type: SLEEP_WINDOW_REMINDER_TYPE,
                recommendedStart: recommendedStart.toISOString(),
                confidence: sleepPrediction.confidence,
              },
            },
            identifier: SLEEP_WINDOW_REMINDER_IDENTIFIER,
            trigger: null,
          });

          if (!isMounted) {
            await Notifications.cancelScheduledNotificationAsync(immediateId);
            return;
          }

          scheduledNotificationIdRef.current = immediateId;

          if (hasRemoteChannel) {
            await syncRemoteReminder(new Date(), scheduleKey, immediateBody);
          }

          lastScheduledRef.current = scheduleKey;
          console.log('⚡ Sleep window reminder sent immediately');
          return;
        }

        lastScheduledRef.current = scheduleKey;
        console.log('⏰ Sleep window reminder skipped (window already started)');
        return;
      }

      // Cancel previous notification
      await cancelCurrentScheduledNotification();

      // Format time for notification body
      const timeString = recommendedStart.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
      });
      const body = `In 15 Minuten beginnt das vorhergesagte Schlaffenster (${timeString})`;

      // Schedule local reminder as primary channel.
      const scheduledId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '💤 Schlaffenster beginnt bald',
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: {
            type: SLEEP_WINDOW_REMINDER_TYPE,
            recommendedStart: recommendedStart.toISOString(),
            confidence: sleepPrediction.confidence,
          },
        },
        identifier: SLEEP_WINDOW_REMINDER_IDENTIFIER,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fifteenMinBefore,
        },
      });

      if (!isMounted) {
        await Notifications.cancelScheduledNotificationAsync(scheduledId);
        return;
      }

      scheduledNotificationIdRef.current = scheduledId;

      // Optional remote sync for secondary devices only.
      if (hasRemoteChannel) {
        await syncRemoteReminder(fifteenMinBefore, scheduleKey, body);
      } else if (userId && babyId) {
        await cancelRemoteReminder();
      }

      lastScheduledRef.current = scheduleKey;
      console.log('✅ Sleep window reminder scheduled locally for', fifteenMinBefore.toLocaleTimeString('de-DE'));
      console.log('   Sleep window starts at:', timeString);
      console.log('   Confidence:', sleepPrediction.confidence);
    };

    syncNotification().catch((error) => {
      console.error('Failed to schedule sleep window reminder:', error);
    });

    return () => {
      isMounted = false;
    };
  }, [
    sleepPrediction,
    enabled,
    hasActiveSleepEntry,
    cancelCurrentScheduledNotification,
    cancelRemoteReminder,
    hasRemoteChannel,
    syncRemoteReminder,
  ]);

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
    Promise.all([
      cancelCurrentScheduledNotification(),
      cancelRemoteReminder(),
    ])
      .then(() => {
        lastScheduledRef.current = null;
        console.log('✅ Sleep window reminder cancelled');
      })
      .catch((error) => {
        console.error('Failed to cancel sleep window reminder:', error);
      });
  };

  return {
    scheduleSleepReminder,
    cancelSleepReminder,
  };
}
