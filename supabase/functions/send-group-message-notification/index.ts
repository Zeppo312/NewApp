import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

interface GroupMessageWebhookPayload {
  type: 'INSERT';
  table: 'community_group_messages';
  record: {
    id: string;
    group_id: string;
    sender_id: string;
    content: string;
    created_at: string;
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

    const payload: GroupMessageWebhookPayload = await req.json();

    if (payload.type !== 'INSERT') {
      return new Response(JSON.stringify({ message: 'Not an INSERT event' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sender_id, group_id, content, id } = payload.record;

    // 1. Get group name
    const { data: groupData, error: groupError } = await supabase
      .from('community_groups')
      .select('name')
      .eq('id', group_id)
      .single();

    if (groupError || !groupData) {
      console.error('Error fetching group:', groupError);
      return new Response(
        JSON.stringify({ message: 'Group not found' }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const groupName = groupData.name;

    // 2. Get all active members except sender
    const { data: members, error: membersError } = await supabase
      .from('community_group_members')
      .select('user_id')
      .eq('group_id', group_id)
      .eq('status', 'active')
      .neq('user_id', sender_id);

    if (membersError) {
      console.error('Error fetching group members:', membersError);
      throw membersError;
    }

    if (!members || members.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No other active members in group' }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 3. Get sender display name
    let senderName = 'Jemand';
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('username, first_name, last_name')
      .eq('id', sender_id)
      .maybeSingle();

    if (senderProfile) {
      senderName = getDisplayName(senderProfile);
    } else {
      const { data: rpcProfile } = await supabase.rpc('get_user_profile', {
        user_id_param: sender_id,
      });
      if (rpcProfile && rpcProfile.length > 0) {
        senderName = getDisplayName(rpcProfile[0]);
      }
    }

    // 4. For each member: check notification settings and get push tokens
    const recipientIds = members.map((m) => m.user_id);

    // Batch fetch notification settings
    const { data: settingsData } = await supabase
      .from('user_settings')
      .select('user_id, notifications_enabled')
      .in('user_id', recipientIds);

    const disabledUsers = new Set(
      (settingsData || [])
        .filter((s) => s.notifications_enabled === false)
        .map((s) => s.user_id)
    );

    const eligibleRecipients = recipientIds.filter((id) => !disabledUsers.has(id));

    if (eligibleRecipients.length === 0) {
      return new Response(
        JSON.stringify({ message: 'All recipients have notifications disabled' }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Batch fetch all push tokens for eligible recipients
    const { data: tokens, error: tokenError } = await supabase
      .from('user_push_tokens')
      .select('user_id, token')
      .in('user_id', eligibleRecipients);

    if (tokenError) {
      console.error('Error fetching push tokens:', tokenError);
      throw tokenError;
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No push tokens found for group members' }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // 5. Send push notifications
    const body = content.length > 120
      ? `${content.slice(0, 117)}...`
      : content;

    const pushPayloads = tokens.map((tokenRecord) =>
      fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: tokenRecord.token,
          title: groupName,
          body: `${senderName}: ${body}`,
          sound: 'default',
          priority: 'high',
          data: {
            type: 'group_message',
            referenceId: group_id,
            groupId: group_id,
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
          message: 'Some group message notifications failed',
          errors,
          successCount: tokens.length - errors.length,
        }),
        { headers: { 'Content-Type': 'application/json' }, status: 207 }
      );
    }

    return new Response(
      JSON.stringify({
        message: 'Group message notifications sent successfully',
        count: tokens.length,
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    console.error('Group message notification error:', error);

    return new Response(
      JSON.stringify({
        message: 'Failed to send group message notifications',
        error: String(error),
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
