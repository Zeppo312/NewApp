// Supabase Edge Function to send push notifications when partner activities are created
// This function is triggered by a database webhook when a new partner_activity_notification is inserted

// @ts-ignore - Deno edge function import.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno edge function import.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  getSettingsLocale,
  localeTag,
  localize,
  SupportedLocale,
} from '../_shared/localization.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

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
  babyName: string | null,
  startTime: string,
  locale: SupportedLocale
): { title: string; body: string; emoji: string } => {
  const time = new Date(startTime).toLocaleTimeString(localeTag(locale), {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Berlin'
  });
  const baby = babyName || localize(locale, { de: 'das Baby', en: 'the baby', es: 'el bebé' });
  const at = localize(locale, { de: ' um ', en: ' at ', es: ' a las ' });

  switch (activityType) {
    case 'sleep':
      return {
        title: localize(locale, { de: `${baby}s Schlaf`, en: `${baby}'s sleep`, es: `Sueño de ${baby}` }),
        body: localize(locale, {
          de: `${partnerName} hat ${baby} schlafen gelegt${at}${time}`,
          en: `${partnerName} put ${baby} to sleep${at}${time}`,
          es: `${partnerName} acostó a ${baby}${at}${time}`,
        }),
        emoji: '💤',
      };

    case 'feeding':
      if (activitySubtype === 'BREAST') {
        return {
          title: localize(locale, { de: 'Gestillt', en: 'Breastfed', es: 'Lactancia' }),
          body: localize(locale, { de: `${partnerName} hat ${baby} gestillt${at}${time}`, en: `${partnerName} breastfed ${baby}${at}${time}`, es: `${partnerName} amamantó a ${baby}${at}${time}` }),
          emoji: '🤱',
        };
      } else if (activitySubtype === 'BOTTLE') {
        return {
          title: localize(locale, { de: 'Flasche gegeben', en: 'Bottle given', es: 'Biberón' }),
          body: localize(locale, { de: `${partnerName} hat ${baby} die Flasche gegeben${at}${time}`, en: `${partnerName} gave ${baby} a bottle${at}${time}`, es: `${partnerName} dio el biberón a ${baby}${at}${time}` }),
          emoji: '🍼',
        };
      } else if (activitySubtype === 'SOLIDS') {
        return {
          title: localize(locale, { de: 'Beikost gegeben', en: 'Solid food', es: 'Alimentos sólidos' }),
          body: localize(locale, { de: `${partnerName} hat ${baby} Beikost gegeben${at}${time}`, en: `${partnerName} gave ${baby} solid food${at}${time}`, es: `${partnerName} dio sólidos a ${baby}${at}${time}` }),
          emoji: '🥄',
        };
      } else if (activitySubtype === 'PUMP') {
        return {
          title: localize(locale, { de: 'Milch abgepumpt', en: 'Milk pumped', es: 'Leche extraída' }),
          body: localize(locale, { de: `${partnerName} hat für ${baby} Milch abgepumpt${at}${time}`, en: `${partnerName} pumped milk for ${baby}${at}${time}`, es: `${partnerName} extrajo leche para ${baby}${at}${time}` }),
          emoji: '🥛',
        };
      } else if (activitySubtype === 'WATER') {
        return {
          title: localize(locale, { de: 'Wasser gegeben', en: 'Water given', es: 'Agua' }),
          body: localize(locale, { de: `${partnerName} hat ${baby} Wasser gegeben${at}${time}`, en: `${partnerName} gave ${baby} water${at}${time}`, es: `${partnerName} dio agua a ${baby}${at}${time}` }),
          emoji: '🚰',
        };
      }
      return {
        title: localize(locale, { de: 'Gefüttert', en: 'Fed', es: 'Alimentación' }),
        body: localize(locale, { de: `${partnerName} hat ${baby} gefüttert${at}${time}`, en: `${partnerName} fed ${baby}${at}${time}`, es: `${partnerName} alimentó a ${baby}${at}${time}` }),
        emoji: '🍼',
      };

    case 'diaper':
      if (activitySubtype === 'WET') {
        return {
          title: localize(locale, { de: 'Windel gewechselt', en: 'Diaper changed', es: 'Pañal cambiado' }),
          body: localize(locale, { de: `${partnerName} hat ${baby}s Windel gewechselt (nass)${at}${time}`, en: `${partnerName} changed ${baby}'s diaper (wet)${at}${time}`, es: `${partnerName} cambió el pañal de ${baby} (mojado)${at}${time}` }),
          emoji: '💧',
        };
      } else if (activitySubtype === 'DIRTY') {
        return {
          title: localize(locale, { de: 'Windel gewechselt', en: 'Diaper changed', es: 'Pañal cambiado' }),
          body: localize(locale, { de: `${partnerName} hat ${baby}s Windel gewechselt (voll)${at}${time}`, en: `${partnerName} changed ${baby}'s diaper (dirty)${at}${time}`, es: `${partnerName} cambió el pañal de ${baby} (sucio)${at}${time}` }),
          emoji: '💩',
        };
      } else if (activitySubtype === 'BOTH') {
        return {
          title: localize(locale, { de: 'Windel gewechselt', en: 'Diaper changed', es: 'Pañal cambiado' }),
          body: localize(locale, { de: `${partnerName} hat ${baby}s Windel gewechselt (nass & voll)${at}${time}`, en: `${partnerName} changed ${baby}'s diaper (wet & dirty)${at}${time}`, es: `${partnerName} cambió el pañal de ${baby} (mojado y sucio)${at}${time}` }),
          emoji: '💧💩',
        };
      }
      return {
        title: localize(locale, { de: 'Windel gewechselt', en: 'Diaper changed', es: 'Pañal cambiado' }),
        body: localize(locale, { de: `${partnerName} hat ${baby}s Windel gewechselt${at}${time}`, en: `${partnerName} changed ${baby}'s diaper${at}${time}`, es: `${partnerName} cambió el pañal de ${baby}${at}${time}` }),
        emoji: '💧',
      };

    default:
      return {
        title: localize(locale, { de: 'Partner-Aktivität', en: 'Partner activity', es: 'Actividad de pareja' }),
        body: localize(locale, { de: `${partnerName} hat eine Aktivität für ${baby} eingetragen${at}${time}`, en: `${partnerName} logged an activity for ${baby}${at}${time}`, es: `${partnerName} registró una actividad para ${baby}${at}${time}` }),
        emoji: '📝',
      };
  }
};

serve(async (req: Request) => {
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

    const { data: recipientSettings, error: recipientSettingsError } = await supabase
      .from('user_settings')
      .select('notifications_enabled, partner_notifications_enabled, resolved_language, language_preference')
      .eq('user_id', user_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recipientSettingsError) {
      console.error('❌ Error fetching recipient notification settings:', recipientSettingsError);
    }

    if (
      recipientSettings?.notifications_enabled === false ||
      recipientSettings?.partner_notifications_enabled === false
    ) {
      console.log('⏭️ Notifications disabled for recipient, skipping push send');
      return new Response(
        JSON.stringify({ message: 'Notifications disabled for recipient' }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
    const locale = getSettingsLocale(recipientSettings);

    // Get partner's name from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name')
      .eq('id', partner_id)
      .single();

    const partnerName = profile?.first_name || localize(locale, {
      de: 'Dein Partner',
      en: 'Your partner',
      es: 'Tu pareja',
    });

    // Get baby name and start_time from the entry
    let babyName: string | null = null;
    let startTime: string | null = null;

    if (activity_type === 'sleep') {
      // Get baby_id and start_time from sleep_entries
      const { data: sleepEntry } = await supabase
        .from('sleep_entries')
        .select('baby_id, start_time')
        .eq('id', entry_id)
        .single();

      if (sleepEntry) {
        startTime = sleepEntry.start_time;

        if (sleepEntry.baby_id) {
          const { data: baby } = await supabase
            .from('baby_info')
            .select('name')
            .eq('id', sleepEntry.baby_id)
            .single();

          babyName = baby?.name || null;
        }
      }
    } else if (activity_type === 'feeding' || activity_type === 'diaper') {
      // Get baby_id and start_time from baby_care_entries
      const { data: careEntry } = await supabase
        .from('baby_care_entries')
        .select('baby_id, start_time')
        .eq('id', entry_id)
        .single();

      if (careEntry) {
        startTime = careEntry.start_time;

        if (careEntry.baby_id) {
          const { data: baby } = await supabase
            .from('baby_info')
            .select('name')
            .eq('id', careEntry.baby_id)
            .single();

          babyName = baby?.name || null;
        }
      }
    }

    console.log(`👶 Baby name: ${babyName || 'not found'}`);
    console.log(`🕐 Start time: ${startTime || 'not found'}`);

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

    // Get notification content with baby name and start time
    const { title, body, emoji } = getNotificationContent(
      activity_type,
      activity_subtype,
      partnerName,
      babyName,
      startTime || new Date().toISOString(), // Fallback to current time if not found
      locale
    );

    console.log(`📬 Sending notification: ${emoji} ${title} - ${body}`);

    // Send push notification to each token
    const pushPromises = tokens.map((tokenRecord: { token: string }) =>
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
