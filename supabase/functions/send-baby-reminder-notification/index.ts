// Supabase Edge Function to send push notifications for due baby reminders.
// Triggered by DB webhook from baby_reminder_notifications.

// @ts-ignore - Deno edge function import.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno edge function import.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

interface BabyReminderPayload {
  type: 'baby_reminder_notification';
  notification: {
    id: string;
    user_id: string;
    baby_id: string | null;
    baby_name: string | null;
    reminder_type: 'sleep_window' | 'feeding';
    scheduled_for: string;
    title: string;
    body: string;
    schedule_key: string | null;
    payload?: Record<string, unknown> & {
      excludeToken?: string;
    };
  };
}

const resolveNotificationDataType = (reminderType: 'sleep_window' | 'feeding') => {
  if (reminderType === 'sleep_window') return 'sleep_window_reminder';
  return 'feeding_reminder';
};

serve(async (req: Request) => {
  try {
    const payload: BabyReminderPayload = await req.json();

    if (payload.type !== 'baby_reminder_notification') {
      return new Response(JSON.stringify({ message: 'Unsupported payload type' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const reminder = payload.notification;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: tokens, error: tokenError } = await supabase
      .from('user_push_tokens')
      .select('token')
      .eq('user_id', reminder.user_id);

    if (tokenError) {
      console.error('❌ Error fetching push tokens:', tokenError);
      throw tokenError;
    }

    const excludeToken =
      typeof reminder.payload?.excludeToken === 'string'
        ? reminder.payload.excludeToken
        : null;

    const targetTokens = (tokens || []).filter(
      (tokenRecord: { token: string }) => !excludeToken || tokenRecord.token !== excludeToken
    );

    if (!targetTokens || targetTokens.length === 0) {
      console.log('⚠️ No push tokens for user:', reminder.user_id);
      return new Response(JSON.stringify({ message: 'No push tokens found for user' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const { excludeToken: _excludeTokenFromPayload, ...payloadData } = reminder.payload || {};
    const type = resolveNotificationDataType(reminder.reminder_type);
    const data = {
      type,
      reminderType: reminder.reminder_type,
      notificationId: reminder.id,
      babyId: reminder.baby_id,
      babyName: reminder.baby_name,
      ...payloadData,
    };

    const pushPromises = targetTokens.map((tokenRecord: { token: string }) =>
      fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: tokenRecord.token,
          title: reminder.title,
          body: reminder.body,
          sound: 'default',
          priority: 'high',
          data,
        }),
      })
    );

    const results = await Promise.all(pushPromises);
    const errors: Array<{ token: string; error: unknown }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const responseData = await result.json();
      if (!result.ok || responseData.errors) {
        errors.push({
          token: targetTokens[i].token,
          error: responseData,
        });
      }
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({
          message: 'Some notifications failed',
          errors,
          successCount: targetTokens.length - errors.length,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 207,
        }
      );
    }

    return new Response(
      JSON.stringify({
        message: 'Baby reminder notifications sent successfully',
        count: targetTokens.length,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('❌ Function error:', err);
    return new Response(
      JSON.stringify({
        error: err.message,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
