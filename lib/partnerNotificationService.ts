import * as Notifications from 'expo-notifications';
import { getAppSettings, getCachedUser, supabase } from './supabase';
import { getAppLocaleTag, getPersistedAppLocale, type AppLocale } from './localization';

interface PartnerActivityNotification {
  id: string;
  user_id: string;
  partner_id: string;
  activity_type: 'sleep' | 'feeding' | 'diaper';
  activity_subtype: string | null;
  entry_id: string | null;
  is_read: boolean;
  created_at: string;
}

const NETWORK_ERROR_LOG_THROTTLE_MS = 60_000;
const MAX_LOCAL_PARTNER_NOTIFICATION_AGE_MS = 12 * 60 * 60 * 1000;
let lastNetworkWarningAt = 0;

function extractErrorText(error: unknown): string {
  if (!error) return '';

  if (typeof error === 'string') {
    return error;
  }

  if (typeof error === 'object') {
    const candidate = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    return [candidate.message, candidate.details, candidate.hint, candidate.code]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .join(' ');
  }

  return String(error);
}

function isTransientNetworkError(error: unknown): boolean {
  const text = extractErrorText(error).toLowerCase();
  if (!text) return false;

  return (
    text.includes('network request failed') ||
    text.includes('failed to fetch') ||
    text.includes('internet connection appears to be offline')
  );
}

function logPartnerNotificationError(context: string, error: unknown) {
  if (isTransientNetworkError(error)) {
    const now = Date.now();
    if (now - lastNetworkWarningAt >= NETWORK_ERROR_LOG_THROTTLE_MS) {
      lastNetworkWarningAt = now;
      console.warn(`${context} (temporary network issue)`);
    }
    return;
  }

  console.error(context, error);
}

/**
 * Poll for new partner activity notifications and display them as local notifications
 *
 * This function:
 * 1. Queries unread partner_activity_notifications
 * 2. Gets partner name from profiles
 * 3. Schedules local notifications
 * 4. Marks notifications as read
 *
 * @returns Count of new notifications displayed
 */
export async function pollPartnerActivities(): Promise<number> {
  try {
    // Get current user
    const { data: userData, error: userError } = await getCachedUser();
    if (userError || !userData?.user) {
      console.log('No authenticated user for partner notification polling');
      return 0;
    }

    const userId = userData.user.id;

    const { data: appSettings } = await getAppSettings();
    if (appSettings?.notifications_enabled === false) {
      return 0;
    }
    const locale = await getPersistedAppLocale();

    // Query unread notifications for this user
    const { data: notifications, error: notifError } = await supabase
      .from('partner_activity_notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10); // Limit to recent 10 to avoid overwhelming user

    if (notifError) {
      logPartnerNotificationError('Error fetching partner notifications:', notifError);
      return 0;
    }

    if (!notifications || notifications.length === 0) {
      return 0;
    }

    console.log(`📬 Found ${notifications.length} unread partner notifications`);

    // Process each notification
    for (const notification of notifications as PartnerActivityNotification[]) {
      try {
        const createdAtMs = new Date(notification.created_at).getTime();
        const isFreshEnough =
          Number.isFinite(createdAtMs) &&
          Date.now() - createdAtMs <= MAX_LOCAL_PARTNER_NOTIFICATION_AGE_MS;

        const markedAsRead = await markPartnerNotificationAsRead(notification.id);
        if (!markedAsRead) {
          continue;
        }

        if (!isFreshEnough) {
          console.log(`⏭️ Skipping stale partner notification: ${notification.id}`);
          continue;
        }

        // Get partner name
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', notification.partner_id)
          .single();

        const partnerName = profile?.first_name || {
          de: 'Dein Partner',
          en: 'Your partner',
          es: 'Tu pareja',
        }[locale];

        // Format notification content based on activity type
        const { title, body, emoji } = formatNotificationContent(
          notification.activity_type,
          notification.activity_subtype,
          partnerName,
          notification.created_at,
          locale,
        );

        // Schedule local notification
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `${emoji} ${title}`,
            body,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH,
            data: {
              type: `partner_${notification.activity_type}`,
              referenceId: notification.entry_id,
              notificationId: notification.id,
              partnerId: notification.partner_id,
            },
          },
          trigger: null, // Show immediately
        });

        console.log(`✅ Displayed notification: ${title}`);
      } catch (error) {
        logPartnerNotificationError(`Error processing notification: ${notification.id}`, error);
      }
    }

    return notifications.length;
  } catch (error) {
    logPartnerNotificationError('Error polling partner activities:', error);
    return 0;
  }
}

/**
 * Format notification content based on activity type
 */
function formatNotificationContent(
  activityType: string,
  activitySubtype: string | null,
  partnerName: string,
  createdAt: string,
  locale: AppLocale,
): { title: string; body: string; emoji: string } {
  const time = new Date(createdAt).toLocaleTimeString(getAppLocaleTag(locale), {
    hour: '2-digit',
    minute: '2-digit'
  });
  const c = {
    de: {
      sleep: 'Schlaf-Eintrag', sleepBody: (name: string) => `${name} hat um ${time} einen Schlaf-Eintrag erstellt`,
      breast: 'Stillen', breastBody: (name: string) => `${name} hat um ${time} gestillt`,
      bottle: 'Fläschchen', bottleBody: (name: string) => `${name} hat um ${time} gefüttert`,
      solids: 'Beikost', solidsBody: (name: string) => `${name} hat um ${time} Beikost gegeben`,
      pump: 'Abpumpen', pumpBody: (name: string) => `${name} hat um ${time} Milch abgepumpt`,
      water: 'Wasser', waterBody: (name: string) => `${name} hat um ${time} Wasser gegeben`,
      feeding: 'Fütterung', feedingBody: (name: string) => `${name} hat um ${time} gefüttert`,
      diaper: 'Windel gewechselt', wetBody: (name: string) => `${name} hat um ${time} eine nasse Windel gewechselt`, dirtyBody: (name: string) => `${name} hat um ${time} eine schmutzige Windel gewechselt`, bothBody: (name: string) => `${name} hat um ${time} eine volle Windel gewechselt`, diaperBody: (name: string) => `${name} hat um ${time} eine Windel gewechselt`,
      activity: 'Neue Aktivität', activityBody: (name: string) => `${name} hat um ${time} etwas eingetragen`,
    },
    en: {
      sleep: 'Sleep entry', sleepBody: (name: string) => `${name} logged a sleep entry at ${time}`,
      breast: 'Breastfeeding', breastBody: (name: string) => `${name} breastfed at ${time}`,
      bottle: 'Bottle', bottleBody: (name: string) => `${name} gave a bottle at ${time}`,
      solids: 'Solid food', solidsBody: (name: string) => `${name} served solid food at ${time}`,
      pump: 'Pumping', pumpBody: (name: string) => `${name} pumped milk at ${time}`,
      water: 'Water', waterBody: (name: string) => `${name} gave water at ${time}`,
      feeding: 'Feeding', feedingBody: (name: string) => `${name} logged a feed at ${time}`,
      diaper: 'Diaper changed', wetBody: (name: string) => `${name} changed a wet diaper at ${time}`, dirtyBody: (name: string) => `${name} changed a dirty diaper at ${time}`, bothBody: (name: string) => `${name} changed a wet and dirty diaper at ${time}`, diaperBody: (name: string) => `${name} changed a diaper at ${time}`,
      activity: 'New activity', activityBody: (name: string) => `${name} logged something at ${time}`,
    },
    es: {
      sleep: 'Registro de sueño', sleepBody: (name: string) => `${name} registró una entrada de sueño a las ${time}`,
      breast: 'Lactancia', breastBody: (name: string) => `${name} dio el pecho a las ${time}`,
      bottle: 'Biberón', bottleBody: (name: string) => `${name} dio el biberón a las ${time}`,
      solids: 'Alimentación sólida', solidsBody: (name: string) => `${name} dio comida sólida a las ${time}`,
      pump: 'Extracción', pumpBody: (name: string) => `${name} extrajo leche a las ${time}`,
      water: 'Agua', waterBody: (name: string) => `${name} dio agua a las ${time}`,
      feeding: 'Toma', feedingBody: (name: string) => `${name} registró una toma a las ${time}`,
      diaper: 'Pañal cambiado', wetBody: (name: string) => `${name} cambió un pañal mojado a las ${time}`, dirtyBody: (name: string) => `${name} cambió un pañal sucio a las ${time}`, bothBody: (name: string) => `${name} cambió un pañal mojado y sucio a las ${time}`, diaperBody: (name: string) => `${name} cambió un pañal a las ${time}`,
      activity: 'Nueva actividad', activityBody: (name: string) => `${name} registró una actividad a las ${time}`,
    },
  }[locale];

  // Sleep activities
  if (activityType === 'sleep') {
    return {
      emoji: '💤',
      title: c.sleep,
      body: c.sleepBody(partnerName),
    };
  }

  // Feeding activities
  if (activityType === 'feeding') {
    switch (activitySubtype) {
      case 'BREAST':
        return {
          emoji: '🤱',
          title: c.breast,
          body: c.breastBody(partnerName),
        };
      case 'BOTTLE':
        return {
          emoji: '🍼',
          title: c.bottle,
          body: c.bottleBody(partnerName),
        };
      case 'SOLIDS':
        return {
          emoji: '🥄',
          title: c.solids,
          body: c.solidsBody(partnerName),
        };
      case 'PUMP':
        return {
          emoji: '🥛',
          title: c.pump,
          body: c.pumpBody(partnerName),
        };
      case 'WATER':
        return {
          emoji: '🚰',
          title: c.water,
          body: c.waterBody(partnerName),
        };
      default:
        return {
          emoji: '🍼',
          title: c.feeding,
          body: c.feedingBody(partnerName),
        };
    }
  }

  // Diaper activities
  if (activityType === 'diaper') {
    switch (activitySubtype) {
      case 'WET':
        return {
          emoji: '💧',
          title: c.diaper,
          body: c.wetBody(partnerName),
        };
      case 'DIRTY':
        return {
          emoji: '💩',
          title: c.diaper,
          body: c.dirtyBody(partnerName),
        };
      case 'BOTH':
        return {
          emoji: '💧💩',
          title: c.diaper,
          body: c.bothBody(partnerName),
        };
      default:
        return {
          emoji: '🧷',
          title: c.diaper,
          body: c.diaperBody(partnerName),
        };
    }
  }

  // Default fallback
  return {
    emoji: '📱',
    title: c.activity,
    body: c.activityBody(partnerName),
  };
}

/**
 * Get count of unread partner notifications
 */
export async function getUnreadPartnerNotificationCount(): Promise<number> {
  try {
    const { data: userData, error: userError } = await getCachedUser();
    if (userError || !userData?.user) {
      return 0;
    }

    const { count, error } = await supabase
      .from('partner_activity_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userData.user.id)
      .eq('is_read', false);

    if (error) {
      logPartnerNotificationError('Error getting unread notification count:', error);
      return 0;
    }

    return count || 0;
  } catch (error) {
    logPartnerNotificationError('Error getting unread notification count:', error);
    return 0;
  }
}

/**
 * Mark a partner notification as read
 */
export async function markPartnerNotificationAsRead(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('partner_activity_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

/**
 * Mark all partner notifications as read
 */
export async function markAllPartnerNotificationsAsRead(): Promise<boolean> {
  try {
    const { data: userData, error: userError } = await getCachedUser();
    if (userError || !userData?.user) {
      return false;
    }

    const { error } = await supabase
      .from('partner_activity_notifications')
      .update({ is_read: true })
      .eq('user_id', userData.user.id)
      .eq('is_read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }

    console.log('✅ Marked all partner notifications as read');
    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
}

/**
 * Delete old read notifications (cleanup function)
 * Deletes notifications older than 30 days that have been read
 */
export async function cleanupOldNotifications(): Promise<boolean> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { error } = await supabase
      .from('partner_activity_notifications')
      .delete()
      .eq('is_read', true)
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (error) {
      console.error('Error cleaning up old notifications:', error);
      return false;
    }

    console.log('✅ Cleaned up old partner notifications');
    return true;
  } catch (error) {
    console.error('Error cleaning up old notifications:', error);
    return false;
  }
}
