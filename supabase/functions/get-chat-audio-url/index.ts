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
  audio_duration_ms: number | null;
  audio_mime_type: string | null;
};

type GroupMessageRow = {
  id: string;
  group_id: string;
  sender_id: string;
  message_type: 'text' | 'voice';
  audio_storage_path: string | null;
  audio_duration_ms: number | null;
  audio_mime_type: string | null;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const CORS_HEADERS = {
  ...JSON_HEADERS,
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const URL_TTL_SECONDS = 300;

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
        .select('id, sender_id, receiver_id, message_type, audio_storage_path, audio_duration_ms, audio_mime_type')
        .eq('id', messageId)
        .maybeSingle<DirectMessageRow>();

      if (error || !message) {
        return new Response(JSON.stringify({ message: 'Message not found' }), {
          headers: CORS_HEADERS,
          status: 404,
        });
      }

      if (message.sender_id !== user.id && message.receiver_id !== user.id) {
        return new Response(JSON.stringify({ message: 'Forbidden' }), {
          headers: CORS_HEADERS,
          status: 403,
        });
      }

      if (message.message_type !== 'voice' || !message.audio_storage_path) {
        return new Response(JSON.stringify({ message: 'No audio for message' }), {
          headers: CORS_HEADERS,
          status: 400,
        });
      }

      const { data: signedUrl, error: signedUrlError } = await serviceClient.storage
        .from('chat-audio')
        .createSignedUrl(message.audio_storage_path, URL_TTL_SECONDS);

      if (signedUrlError || !signedUrl?.signedUrl) {
        return new Response(JSON.stringify({ message: 'Failed to sign audio url' }), {
          headers: CORS_HEADERS,
          status: 500,
        });
      }

      return new Response(
        JSON.stringify({
          url: signedUrl.signedUrl,
          expiresAt: new Date(Date.now() + URL_TTL_SECONDS * 1000).toISOString(),
          durationMs: message.audio_duration_ms,
          mimeType: message.audio_mime_type ?? 'audio/mp4',
        }),
        { headers: CORS_HEADERS, status: 200 },
      );
    }

    const { data: message, error } = await serviceClient
      .from('community_group_messages')
      .select('id, group_id, sender_id, message_type, audio_storage_path, audio_duration_ms, audio_mime_type')
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
      .select('user_id')
      .eq('group_id', message.group_id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ message: 'Forbidden' }), {
        headers: CORS_HEADERS,
        status: 403,
      });
    }

    if (message.message_type !== 'voice' || !message.audio_storage_path) {
      return new Response(JSON.stringify({ message: 'No audio for message' }), {
        headers: CORS_HEADERS,
        status: 400,
      });
    }

    const { data: signedUrl, error: signedUrlError } = await serviceClient.storage
      .from('chat-audio')
      .createSignedUrl(message.audio_storage_path, URL_TTL_SECONDS);

    if (signedUrlError || !signedUrl?.signedUrl) {
      return new Response(JSON.stringify({ message: 'Failed to sign audio url' }), {
        headers: CORS_HEADERS,
        status: 500,
      });
    }

    return new Response(
        JSON.stringify({
          url: signedUrl.signedUrl,
          expiresAt: new Date(Date.now() + URL_TTL_SECONDS * 1000).toISOString(),
          durationMs: message.audio_duration_ms,
          mimeType: message.audio_mime_type ?? 'audio/mp4',
        }),
      { headers: CORS_HEADERS, status: 200 },
    );
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
