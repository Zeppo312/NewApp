/* eslint-disable import/no-unresolved */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: {
  env: {
    get: (key: string) => string | undefined;
  };
};

type ChatScope = 'direct' | 'group';

type DirectMessageRow = {
  id: string;
  sender_id: string;
  receiver_id: string;
  message_type: 'text' | 'voice';
  audio_storage_path: string | null;
};

type GroupMessageRow = {
  id: string;
  group_id: string;
  sender_id: string;
  message_type: 'text' | 'voice' | 'event';
  event_id: string | null;
  audio_storage_path: string | null;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const CORS_HEADERS = {
  ...JSON_HEADERS,
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: CORS_HEADERS });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = req.headers.get('Authorization');

    if (!authorization) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        headers: CORS_HEADERS,
        status: 401,
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), {
        headers: CORS_HEADERS,
        status: 401,
      });
    }

    const body = (await req.json()) as { scope?: ChatScope; messageId?: string };
    const scope = body.scope;
    const messageId = body.messageId;

    if (!scope || !messageId || (scope !== 'direct' && scope !== 'group')) {
      return new Response(JSON.stringify({ message: 'Invalid payload' }), {
        headers: CORS_HEADERS,
        status: 400,
      });
    }

    if (scope === 'direct') {
      const { data: message, error } = await serviceClient
        .from('direct_messages')
        .select('id, sender_id, receiver_id, message_type, audio_storage_path')
        .eq('id', messageId)
        .maybeSingle<DirectMessageRow>();

      if (error || !message) {
        return new Response(JSON.stringify({ message: 'Message not found' }), {
          headers: CORS_HEADERS,
          status: 404,
        });
      }

      if (message.sender_id !== user.id) {
        return new Response(JSON.stringify({ message: 'Forbidden' }), {
          headers: CORS_HEADERS,
          status: 403,
        });
      }

      if (message.message_type === 'voice' && message.audio_storage_path) {
        await serviceClient.storage.from('chat-audio').remove([message.audio_storage_path]);
      }

      const { error: deleteError } = await serviceClient
        .from('direct_messages')
        .delete()
        .eq('id', messageId);

      if (deleteError) {
        return new Response(JSON.stringify({ message: 'Delete failed' }), {
          headers: CORS_HEADERS,
          status: 500,
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: CORS_HEADERS,
        status: 200,
      });
    }

    const { data: message, error } = await serviceClient
      .from('community_group_messages')
      .select('id, group_id, sender_id, message_type, event_id, audio_storage_path')
      .eq('id', messageId)
      .maybeSingle<GroupMessageRow>();

    if (error || !message) {
      return new Response(JSON.stringify({ message: 'Message not found' }), {
        headers: CORS_HEADERS,
        status: 404,
      });
    }

    const { data: membership } = await serviceClient
      .from('community_group_members')
      .select('role, status')
      .eq('group_id', message.group_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle<{ role: 'owner' | 'admin' | 'member'; status: 'active' }>();

    const canDelete = message.sender_id === user.id || membership?.role === 'owner' || membership?.role === 'admin';
    if (!canDelete) {
      return new Response(JSON.stringify({ message: 'Forbidden' }), {
        headers: CORS_HEADERS,
        status: 403,
      });
    }

    if (message.message_type === 'event' || message.event_id) {
      return new Response(JSON.stringify({ message: 'Event messages must be managed through event actions' }), {
        headers: CORS_HEADERS,
        status: 409,
      });
    }

    if (message.message_type === 'voice' && message.audio_storage_path) {
      await serviceClient.storage.from('chat-audio').remove([message.audio_storage_path]);
    }

    const { error: deleteError } = await serviceClient
      .from('community_group_messages')
      .delete()
      .eq('id', messageId);

    if (deleteError) {
      return new Response(JSON.stringify({ message: 'Delete failed' }), {
        headers: CORS_HEADERS,
        status: 500,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: CORS_HEADERS,
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        message: 'Unexpected error',
        error: String(error),
      }),
      { headers: CORS_HEADERS, status: 500 },
    );
  }
});
