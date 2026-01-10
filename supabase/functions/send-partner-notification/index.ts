// Supabase Edge Function to send push notifications when partner activities are created
// This function is triggered by a database webhook when a new partner_activity_notification is inserted

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotificationPayload {
  type: 'INSERT';
  table: string;
  record: {
    id: string;
    user_id: string;
    partner_id: string;
    activity_type: string;
    activity_subtype: string | null;
    entry_id: string;
    created_at: string;
  };
}

// Notification content templates with personalized baby names
const getNotificationContent = (
  activityType: string,
  activitySubtype: string | null,
  partnerName: string,
  babyName: string | null
): { title: string; body: string; emoji: string } => {
  const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const baby = babyName || 'das Baby';

  switch (activityType) {
    case 'sleep':
      return {
        title: `${baby}s Schlaf`,
        body: `${partnerName} hat ${baby} schlafen gelegt um ${time}`,
        emoji: '💤',
      };

    case 'feeding':
      if (activitySubtype === 'BREAST') {
        return {
          title: 'Gestillt',
          body: `${partnerName} hat ${baby} gestillt um ${time}`,
          emoji: '🤱',
        };
      } else if (activitySubtype === 'BOTTLE') {
        return {
          title: 'Flasche gegeben',
          body: `${partnerName} hat ${baby} die Flasche gegeben um ${time}`,
          emoji: '🍼',
        };
      } else if (activitySubtype === 'SOLIDS') {
        return {
          title: 'Beikost gegeben',
          body: `${partnerName} hat ${baby} Beikost gegeben um ${time}`,
          emoji: '🥄',
        };
      }
      return {
        title: 'Gefüttert',
        body: `${partnerName} hat ${baby} gefüttert um ${time}`,
        emoji: '🍼',
      };

    case 'diaper':
      if (activitySubtype === 'WET') {
        return {
          title: 'Windel gewechselt',
          body: `${partnerName} hat ${baby}s Windel gewechselt (nass) um ${time}`,
          emoji: '💧',
        };
      } else if (activitySubtype === 'DIRTY') {
        return {
          title: 'Windel gewechselt',
          body: `${partnerName} hat ${baby}s Windel gewechselt (voll) um ${time}`,
          emoji: '💩',
        };
      } else if (activitySubtype === 'BOTH') {
        return {
          title: 'Windel gewechselt',
          body: `${partnerName} hat ${baby}s Windel gewechselt (nass & voll) um ${time}`,
          emoji: '💧💩',
        };
      }
      return {
        title: 'Windel gewechselt',
        body: `${partnerName} hat ${baby}s Windel gewechselt um ${time}`,
        emoji: '💧',
      };

    default:
      return {
        title: 'Partner Aktivität',
        body: `${partnerName} hat eine Aktivität für ${baby} eingetragen um ${time}`,
        emoji: '📝',
      };
  }
};

serve(async (req) => {
  try {
    // Get the webhook payload
    const payload: NotificationPayload = await req.json();

    console.log('📨 Received webhook:', {
      type: payload.type,
      table: payload.table,
      notificationId: payload.record.id,
      userId: payload.record.user_id,
      partnerId: payload.record.partner_id,
      activityType: payload.record.activity_type,
    });

    // Only process INSERT events
    if (payload.type !== 'INSERT') {
      console.log('⏭️ Skipping non-INSERT event');
      return new Response(JSON.stringify({ message: 'Not an INSERT event' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Initialize Supabase client with service role key (bypasses RLS)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { user_id, partner_id, activity_type, activity_subtype, entry_id } = payload.record;

    // Get partner's name from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', partner_id)
      .single();

    const partnerName = profile?.first_name || 'Dein Partner';

    // Get baby name from the entry
    let babyName: string | null = null;

    if (activity_type === 'sleep') {
      // Get baby_id from sleep_entries
      const { data: sleepEntry } = await supabase
        .from('sleep_entries')
        .select('baby_id')
        .eq('id', entry_id)
        .single();

      if (sleepEntry?.baby_id) {
        const { data: baby } = await supabase
          .from('baby_info')
          .select('name')
          .eq('id', sleepEntry.baby_id)
          .single();

        babyName = baby?.name || null;
      }
    } else if (activity_type === 'feeding' || activity_type === 'diaper') {
      // Get baby_id from baby_care_entries
      const { data: careEntry } = await supabase
        .from('baby_care_entries')
        .select('baby_id')
        .eq('id', entry_id)
        .single();

      if (careEntry?.baby_id) {
        const { data: baby } = await supabase
          .from('baby_info')
          .select('name')
          .eq('id', careEntry.baby_id)
          .single();

        babyName = baby?.name || null;
      }
    }

    console.log(`👶 Baby name: ${babyName || 'not found'}`);

    // Get push tokens for the user who should receive the notification
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

    // Get notification content with baby name
    const { title, body, emoji } = getNotificationContent(
      activity_type,
      activity_subtype,
      partnerName,
      babyName
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
            type: `partner_${activity_type}`,
            referenceId: entry_id,
            notificationId: payload.record.id,
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
        message: 'Notifications sent successfully',
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
