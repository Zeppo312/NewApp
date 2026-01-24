// Supabase Edge Function to send push notifications for planner events and todos
// This function is triggered by a database webhook when planner notifications are due

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PlannerNotificationPayload {
  type: 'planner_notification';
  notification: {
    id: string;
    user_id: string;
    notification_type: 'event_reminder' | 'todo_due' | 'todo_overdue';
    scheduled_for: string;
    reminder_minutes: number | null;
  };
  planner_item: {
    id: string;
    entry_type: 'event' | 'todo' | 'note';
    title: string;
    notes: string | null;
    location: string | null;
    assignee: 'me' | 'partner' | 'family' | 'child' | null;
    baby_id: string | null;
    baby_name: string | null;
    start_at: string | null;
    end_at: string | null;
    due_at: string | null;
    day: string;
  };
}

// Get notification content based on type and planner item
const getNotificationContent = (
  notificationType: string,
  plannerItem: PlannerNotificationPayload['planner_item'],
  reminderMinutes: number | null
): { title: string; body: string; emoji: string } => {
  const { entry_type, title, location, baby_name, assignee } = plannerItem;

  // Format time based on entry type
  let timeStr = '';
  if (entry_type === 'event' && plannerItem.start_at) {
    const startTime = new Date(plannerItem.start_at);
    timeStr = startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } else if (entry_type === 'todo' && plannerItem.due_at) {
    const dueTime = new Date(plannerItem.due_at);
    timeStr = dueTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  }

  // Add location if available
  const locationStr = location ? ` in ${location}` : '';

  // Add baby name if available and assigned to child
  const babyStr = baby_name && assignee === 'child' ? ` für ${baby_name}` : '';

  // Build notification based on type
  switch (notificationType) {
    case 'event_reminder': {
      const reminderText = reminderMinutes ? ` in ${reminderMinutes} Minuten` : '';
      return {
        title: `Termin${reminderText}`,
        body: `${title}${babyStr} um ${timeStr}${locationStr}`,
        emoji: '📅',
      };
    }

    case 'todo_due': {
      return {
        title: 'Aufgabe fällig',
        body: `${title}${babyStr} um ${timeStr}`,
        emoji: '✓',
      };
    }

    case 'todo_overdue': {
      return {
        title: 'Aufgabe überfällig',
        body: `${title}${babyStr} war fällig um ${timeStr}`,
        emoji: '⚠️',
      };
    }

    default: {
      return {
        title: 'Planner Erinnerung',
        body: title,
        emoji: '📋',
      };
    }
  }
};

serve(async (req) => {
  try {
    // Get the webhook payload
    const payload: PlannerNotificationPayload = await req.json();

    console.log('📨 Received planner notification webhook:', {
      type: payload.type,
      notificationId: payload.notification.id,
      userId: payload.notification.user_id,
      notificationType: payload.notification.notification_type,
      plannerItemId: payload.planner_item.id,
      plannerItemType: payload.planner_item.entry_type,
      plannerItemTitle: payload.planner_item.title,
    });

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, notification_type, reminder_minutes } = payload.notification;
    const { baby_name } = payload.planner_item;

    // Get user's name for personalization
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', user_id)
      .single();

    const userName = profile?.first_name || 'du';

    console.log(`👤 User name: ${userName}`);
    if (baby_name) {
      console.log(`👶 Baby name: ${baby_name}`);
    }

    // Get push tokens for the user
    const { data: tokens, error: tokenError } = await supabase
      .from('user_push_tokens')
      .select('token')
      .eq('user_id', user_id);

    if (tokenError) {
      console.error('❌ Error fetching push tokens:', tokenError);
      throw tokenError;
    }

    if (!tokens || tokens.length === 0) {
      console.log('⚠️ No push tokens found for user:', user_id);
      return new Response(
        JSON.stringify({ message: 'No push tokens found for user' }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`📱 Found ${tokens.length} push token(s) for user ${user_id}`);

    // Get notification content
    const { title, body, emoji } = getNotificationContent(
      notification_type,
      payload.planner_item,
      reminder_minutes
    );

    console.log(`📬 Sending notification: ${emoji} ${title} - ${body}`);

    // Send push notification to each token
    const pushPromises = tokens.map((tokenRecord) =>
      fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: tokenRecord.token,
          title: `${emoji} ${title}`,
          body,
          sound: 'default',
          priority: 'high',
          data: {
            type: 'planner_item',
            referenceId: payload.planner_item.id,
            notificationId: payload.notification.id,
            entryType: payload.planner_item.entry_type,
            day: payload.planner_item.day,
          },
        }),
      })
    );

    const results = await Promise.all(pushPromises);

    // Check for errors in push notification responses
    const errors = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const responseData = await result.json();

      if (!result.ok || responseData.errors) {
        errors.push({
          token: tokens[i].token,
          error: responseData,
        });
        console.error('❌ Error sending push notification:', responseData);
      } else {
        console.log('✅ Push notification sent successfully:', {
          token: tokens[i].token.substring(0, 20) + '...',
          response: responseData,
        });
      }
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({
          message: 'Some notifications failed',
          errors,
          successCount: tokens.length - errors.length,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 207, // Multi-Status
        }
      );
    }

    return new Response(
      JSON.stringify({
        message: 'Planner notifications sent successfully',
        count: tokens.length,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('❌ Function error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
