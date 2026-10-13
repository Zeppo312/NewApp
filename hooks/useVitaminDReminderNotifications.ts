import { useEffect } from 'react';

import { cancelVitaminDReminder, syncVitaminDReminderSchedule } from '@/lib/vitaminDReminder';
import { useLocale } from '@/contexts/LocaleContext';

export function useVitaminDReminderNotifications(
  enabled: boolean,
  hour: number,
  minute: number,
  userId?: string | null,
) {
  const { locale } = useLocale();
  useEffect(() => {
    if (!userId) {
      return;
    }

    let active = true;

    const sync = async () => {
      if (!enabled) {
        await cancelVitaminDReminder(userId);
        return;
      }

      const result = await syncVitaminDReminderSchedule({
        userId,
        enabled,
        hour,
        minute,
        locale,
      });

      if (!active) {
        await cancelVitaminDReminder(userId);
        return;
      }

      if (!result.permissionGranted) {
        console.log('Vitamin D reminder skipped because notification permission is missing');
      } else if (!result.scheduled) {
        console.log('Vitamin D reminder was not scheduled');
      }
    };

    void sync().catch((error) => {
      console.error('Failed to sync Vitamin D reminder:', error);
    });

    return () => {
      active = false;
    };
  }, [enabled, hour, locale, minute, userId]);
}
