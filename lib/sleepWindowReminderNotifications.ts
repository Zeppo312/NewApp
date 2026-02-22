import * as Notifications from 'expo-notifications';

export const SLEEP_WINDOW_REMINDER_IDENTIFIER = 'sleep-window-reminder';
export const SLEEP_WINDOW_REMINDER_TYPE = 'sleep_window_reminder';

export async function cancelLocalSleepWindowReminders(extraIds: string[] = []): Promise<void> {
  const idsToCancel = new Set<string>(extraIds.filter(Boolean));

  try {
    const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
    for (const item of allScheduled) {
      const type = (item.content.data as { type?: string } | undefined)?.type;
      if (
        item.identifier === SLEEP_WINDOW_REMINDER_IDENTIFIER ||
        type === SLEEP_WINDOW_REMINDER_TYPE
      ) {
        idsToCancel.add(item.identifier);
      }
    }
  } catch (error) {
    console.error('Failed to list scheduled sleep window reminders:', error);
  }

  if (idsToCancel.size === 0) {
    // Fallback: try the canonical identifier directly.
    idsToCancel.add(SLEEP_WINDOW_REMINDER_IDENTIFIER);
  }

  for (const id of idsToCancel) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      console.error('Failed to cancel sleep window reminder:', error);
    }
  }
}
