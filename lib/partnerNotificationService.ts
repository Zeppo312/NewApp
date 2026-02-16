import * as Notifications from 'expo-notifications';
import { supabase } from './supabase';
import { getCachedUser } from './supabase';

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
        // Get partner name
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name')
          .eq('id', notification.partner_id)
          .single();

        const partnerName = profile?.first_name || 'Dein Partner';

        // Format notification content based on activity type
        const { title, body, emoji } = formatNotificationContent(
          notification.activity_type,
          notification.activity_subtype,
          partnerName,
          notification.created_at
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

        // Mark notification as read
        await markPartnerNotificationAsRead(notification.id);
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
  createdAt: string
): { title: string; body: string; emoji: string } {
  const time = new Date(createdAt).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Sleep activities
  if (activityType === 'sleep') {
    return {
      emoji: '💤',
      title: 'Schlaf-Eintrag',
      body: `${partnerName} hat einen Schlaf-Eintrag erstellt um ${time}`
    };
  }

  // Feeding activities
  if (activityType === 'feeding') {
    switch (activitySubtype) {
      case 'BREAST':
        return {
          emoji: '🤱',
          title: 'Stillen',
          body: `${partnerName} hat gestillt um ${time}`
        };
      case 'BOTTLE':
        return {
          emoji: '🍼',
          title: 'Fläschchen',
          body: `${partnerName} hat gefüttert um ${time}`
        };
      case 'SOLIDS':
        return {
          emoji: '🥄',
          title: 'Beikost',
          body: `${partnerName} hat Beikost gegeben um ${time}`
        };
      default:
        return {
          emoji: '🍼',
          title: 'Fütterung',
          body: `${partnerName} hat gefüttert um ${time}`
        };
    }
  }

  // Diaper activities
  if (activityType === 'diaper') {
    switch (activitySubtype) {
      case 'WET':
        return {
          emoji: '💧',
          title: 'Windel gewechselt',
          body: `${partnerName} hat eine nasse Windel gewechselt um ${time}`
        };
      case 'DIRTY':
        return {
          emoji: '💩',
          title: 'Windel gewechselt',
          body: `${partnerName} hat eine schmutzige Windel gewechselt um ${time}`
        };
      case 'BOTH':
        return {
          emoji: '💧💩',
          title: 'Windel gewechselt',
          body: `${partnerName} hat eine volle Windel gewechselt um ${time}`
        };
      default:
        return {
          emoji: '🧷',
          title: 'Windel gewechselt',
          body: `${partnerName} hat eine Windel gewechselt um ${time}`
        };
    }
  }

  // Default fallback
  return {
    emoji: '📱',
    title: 'Neue Aktivität',
    body: `${partnerName} hat etwas eingetragen um ${time}`
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
