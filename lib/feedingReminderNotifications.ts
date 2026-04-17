import * as Notifications from 'expo-notifications';

export const FEEDING_REMINDER_IDENTIFIER = 'feeding-reminder';
export const FEEDING_REMINDER_TYPE = 'feeding_reminder';

export async function cancelLocalFeedingReminders(extraIds: string[] = []): Promise<void> {
  const idsToCancel = new Set<string>(extraIds.filter(Boolean));

  try {
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of allScheduled) {
      const type = (item.content.data as { type?: string } | undefined)?.type;
      if (
        item.identifier === FEEDING_REMINDER_IDENTIFIER ||
        type === FEEDING_REMINDER_TYPE
      ) {
        idsToCancel.add(item.identifier);
      }
    }
  } catch (error) {
    console.error('Failed to list scheduled feeding reminders:', error);
  }

  if (idsToCancel.size === 0) {
    idsToCancel.add(FEEDING_REMINDER_IDENTIFIER);
  }

  for (const id of idsToCancel) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      console.error('Failed to cancel feeding reminder:', error);
    }

    try {
      await Notifications.dismissNotificationAsync(id);
    } catch {
      // Already dismissed or not yet presented.
    }
  }
}
