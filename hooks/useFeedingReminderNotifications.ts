import { useCallback, useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import type { FeedingPrediction } from '@/lib/feeding-interval';
import {
  cancelBabyReminderNotification,
  upsertBabyReminderNotification,
} from '@/lib/babyReminderNotifications';
import {
  cancelLocalFeedingReminders,
  FEEDING_REMINDER_IDENTIFIER,
  FEEDING_REMINDER_TYPE,
} from '@/lib/feedingReminderNotifications';
import {
  markReminderNotificationHandled,
  wasReminderNotificationHandled,
} from '@/lib/reminderNotificationState';

/**
 * Hook für Fütterungs-Erinnerungen
 *
 * Scheduled eine Notification 10 Minuten vor dem berechneten Fütterungszeitpunkt.
 * Cancelt vorherige Notifications wenn sich die Prediction ändert.
 */
export function useFeedingReminderNotifications(
  prediction: FeedingPrediction | null,
  enabled: boolean = true,
  userId?: string | null,
  babyId?: string | null,
  currentDevicePushToken?: string | null,
  hasActiveFeedingEntry: boolean = false,
) {
  const lastScheduledRef = useRef<string | null>(null);
  const scheduledNotificationIdRef = useRef<string | null>(null);
  const lastRemoteTokenRef = useRef<string | null>(null);
  // Remote reminders are optional and used only for additional devices.
  // Local scheduling remains primary to work reliably while app is closed.
  const hasRemoteChannel = Boolean(userId && babyId && currentDevicePushToken);

  const cancelCurrentScheduledNotification = useCallback(async () => {
    const scheduledId = scheduledNotificationIdRef.current;
    await cancelLocalFeedingReminders(scheduledId ? [scheduledId] : []);
    scheduledNotificationIdRef.current = null;
  }, []);

  const cancelRemoteReminder = useCallback(async () => {
    if (!userId || !babyId) return;
    try {
      await cancelBabyReminderNotification({
        userId,
        babyId,
        reminderType: 'feeding',
      });
    } catch (error) {
      console.error('Failed to cancel remote feeding reminder:', error);
    }
  }, [userId, babyId]);

  const syncRemoteReminder = useCallback(
    async (scheduledFor: Date, scheduleKey: string, body: string, intervalMinutes: number) => {
      if (!userId || !babyId) return;
      try {
        await upsertBabyReminderNotification({
          userId,
          babyId,
          reminderType: 'feeding',
          scheduledFor,
          title: '🍼 Bald Zeit zum Füttern',
          body,
          scheduleKey,
          payload: {
            type: FEEDING_REMINDER_TYPE,
            nextFeedingTime: scheduleKey,
            intervalMinutes,
            excludeToken: currentDevicePushToken,
          },
        });
      } catch (error) {
        console.error('Failed to sync remote feeding reminder:', error);
      }
    },
    [userId, babyId, currentDevicePushToken]
  );

  useEffect(() => {
    let isMounted = true;

    const syncNotification = async () => {
      // Cancel wenn deaktiviert, aktive Feeding-Session läuft oder keine Prediction vorhanden ist.
      if (!enabled || !prediction || hasActiveFeedingEntry) {
        await Promise.all([
          cancelCurrentScheduledNotification(),
          cancelRemoteReminder(),
        ]);
        lastScheduledRef.current = null;
        return;
      }

      const nextFeeding = new Date(prediction.nextFeedingTime);
      const tenMinBefore = new Date(nextFeeding.getTime() - 10 * 60 * 1000);
      const now = new Date();
      const scheduleKey = nextFeeding.toISOString();
      const remoteTokenChanged =
        hasRemoteChannel && lastRemoteTokenRef.current !== currentDevicePushToken;

      // Prüfe ob bereits für diesen Zeitpunkt geplant
      if (lastScheduledRef.current === scheduleKey && !remoteTokenChanged) {
        return;
      }

      // Trigger-Zeitpunkt ist vorbei: alte Reminder entfernen und ggf. sofort erinnern
      if (tenMinBefore <= now) {
        await Promise.all([
          cancelCurrentScheduledNotification(),
          cancelRemoteReminder(),
        ]);

        const msUntilFeeding = nextFeeding.getTime() - now.getTime();
        const shouldSendImmediate = msUntilFeeding > 0 && msUntilFeeding <= 10 * 60 * 1000;

        if (shouldSendImmediate) {
          const alreadyHandled = await wasReminderNotificationHandled(
            'feeding',
            scheduleKey,
            userId,
            babyId
          );
          if (alreadyHandled) {
            lastScheduledRef.current = scheduleKey;
            console.log('⏭️ Feeding immediate reminder already handled for this schedule');
            return;
          }

          const minutesUntilFeeding = Math.max(1, Math.round(msUntilFeeding / 60000));
          const immediateBody = `Das vorhergesagte Feeding ist in ca. ${minutesUntilFeeding} Minuten`;

          const immediateId = await Notifications.scheduleNotificationAsync({
            content: {
              title: '🍼 Bald Zeit zum Füttern',
              body: immediateBody,
              sound: true,
              priority: Notifications.AndroidNotificationPriority.HIGH,
              data: {
                type: FEEDING_REMINDER_TYPE,
                nextFeedingTime: nextFeeding.toISOString(),
                intervalMinutes: prediction.intervalMinutes,
              },
            },
            identifier: FEEDING_REMINDER_IDENTIFIER,
            trigger: null,
          });

          if (!isMounted) {
            await Notifications.cancelScheduledNotificationAsync(immediateId);
            return;
          }

          scheduledNotificationIdRef.current = immediateId;
          await markReminderNotificationHandled('feeding', scheduleKey, userId, babyId);

          if (hasRemoteChannel) {
            await syncRemoteReminder(new Date(), scheduleKey, immediateBody, prediction.intervalMinutes);
            lastRemoteTokenRef.current = currentDevicePushToken ?? null;
          } else {
            lastRemoteTokenRef.current = null;
          }

          lastScheduledRef.current = scheduleKey;
          return;
        }

        lastScheduledRef.current = scheduleKey;
        return;
      }

      // Vorherige Notification canceln
      await cancelCurrentScheduledNotification();

      // Uhrzeit formatieren
      const timeString = nextFeeding.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const body = `In ca. 10 Minuten könnte dein Baby wieder Hunger haben (ca. ${timeString})`;

      // Schedule local reminder as primary channel.
      const scheduledId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🍼 Bald Zeit zum Füttern',
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          data: {
            type: FEEDING_REMINDER_TYPE,
            nextFeedingTime: nextFeeding.toISOString(),
            intervalMinutes: prediction.intervalMinutes,
          },
        },
        identifier: FEEDING_REMINDER_IDENTIFIER,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: tenMinBefore,
        },
      });

      if (!isMounted) {
        await Notifications.cancelScheduledNotificationAsync(scheduledId);
        return;
      }

      scheduledNotificationIdRef.current = scheduledId;

      // Optional remote sync for secondary devices only.
      if (hasRemoteChannel) {
        await syncRemoteReminder(tenMinBefore, scheduleKey, body, prediction.intervalMinutes);
        lastRemoteTokenRef.current = currentDevicePushToken ?? null;
      } else if (userId && babyId) {
        await cancelRemoteReminder();
        lastRemoteTokenRef.current = null;
      }

      lastScheduledRef.current = scheduleKey;
      console.log('✅ Feeding reminder scheduled locally for', tenMinBefore.toLocaleTimeString('de-DE'));
      console.log('   Next feeding at:', timeString);
      console.log('   Interval:', prediction.intervalMinutes, 'min');
    };

    syncNotification().catch((error) => {
      console.error('Failed to schedule feeding reminder:', error);
    });

    return () => {
      isMounted = false;
    };
  }, [
    prediction,
    enabled,
    cancelCurrentScheduledNotification,
    cancelRemoteReminder,
    hasRemoteChannel,
    hasActiveFeedingEntry,
    syncRemoteReminder,
    userId,
    babyId,
  ]);
}
