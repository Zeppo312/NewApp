import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

interface DirectMessageWebhookPayload {
  type: 'INSERT';
  table: 'direct_messages';
  record: {
    id: string;
    sender_id: string;
    receiver_id: string;
    content: string;
    created_at: string;
    is_read: boolean;
  };
}

type SenderProfile = {
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

const getDisplayName = (profile?: SenderProfile | null) => {
  const username = profile?.username?.trim();
  if (username) return username;
  const first = profile?.first_name?.trim() || '';
  const last = profile?.last_name?.trim() || '';
  return `${first} ${last}`.trim() || 'Jemand';
};

serve(async (req: Request) => {
  try {
    const expectedSecret = Deno.env.get('DIRECT_MESSAGE_WEBHOOK_SECRET');
    const authorization = req.headers.get('Authorization');

    if (!expectedSecret || authorization !== `Bearer ${expectedSecret}`) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const payload: DirectMessageWebhookPayload = await req.json();

    if (payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ message: 'Not an INSERT event' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sender_id, receiver_id, content, id } = payload.record;

    if (sender_id === receiver_id) {
      return new Response(
        JSON.stringify({ message: 'Skipping self direct message notification' }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const { data: recipientSettings, error: recipientSettingsError } = await supabase
      .from('user_settings')
      .select('notifications_enabled')
      .eq('user_id', receiver_id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recipientSettingsError) {
      console.error('Error fetching recipient notification settings:', recipientSettingsError);
    }

    if (recipientSettings?.notifications_enabled === false) {
      return new Response(
        JSON.stringify({ message: 'Notifications disabled for recipient' }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    let senderName = 'Jemand';

    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('username, first_name, last_name')
      .eq('id', sender_id)
      .maybeSingle();

    if (senderProfile) {
      senderName = getDisplayName(senderProfile);
    } else {
      const { data: rpcProfile } = await supabase.rpc('get_user_profile', { user_id_param: sender_id });
      if (rpcProfile && rpcProfile.length > 0) {
        senderName = getDisplayName(rpcProfile[0]);
      }
    }

    const { data: tokens, error: tokenError } = await supabase
      .from('user_push_tokens')
      .select('token')
      .eq('user_id', receiver_id);

    if (tokenError) {
      console.error('Error fetching push tokens:', tokenError);
      throw tokenError;
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No push tokens found for receiver' }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const body = content.length > 140 ? `${content.slice(0, 137)}...` : content;
    const pushPayloads = tokens.map((tokenRecord) =>
      fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: tokenRecord.token,
          title: `Neue Nachricht von ${senderName}`,
          body,
          sound: 'default',
          priority: 'high',
          data: {
            type: 'message',
            referenceId: sender_id,
            senderId: sender_id,
            messageId: id,
          },
        }),
      })
    );

    const results = await Promise.all(pushPayloads);
    const errors: Array<{ token: string; error: unknown }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const responseData = await result.json();

      if (!result.ok || responseData?.errors) {
        errors.push({
          token: tokens[i].token,
          error: responseData,
        });
      }
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({
          message: 'Some direct message notifications failed',
          errors,
          successCount: tokens.length - errors.length,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          status: 207,
        }
      );
    }

    return new Response(
      JSON.stringify({
        message: 'Direct message notifications sent successfully',
        count: tokens.length,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Direct message notification error:', error);

    return new Response(
      JSON.stringify({
        message: 'Failed to send direct message notifications',
        error: String(error),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
