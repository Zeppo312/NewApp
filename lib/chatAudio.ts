import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@/lib/supabase';
import type { ChatScope } from '@/lib/chatMessages';

type SignedAudioUrlResponse = {
  url: string;
  expiresAt: string;
  durationMs: number | null;
  mimeType: string;
};

const CHAT_AUDIO_BUCKET = 'chat-audio';
const DEFAULT_MIME_TYPE = 'audio/mp4';

const base64ToBytes = (base64: string) => {
  const cleaned = base64.includes('base64,') ? base64.split('base64,')[1] : base64;
  const binary = globalThis.atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const createStoragePath = (scope: ChatScope, userId: string) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `${scope}/${userId}/${timestamp}-${random}.m4a`;
};

export async function uploadChatAudio(params: {
  scope: ChatScope;
  userId: string;
  localUri: string;
}) {
  const { scope, userId, localUri } = params;
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
  const bytes = base64ToBytes(base64);
  const storagePath = createStoragePath(scope, userId);

  const { error } = await supabase.storage
    .from(CHAT_AUDIO_BUCKET)
    .upload(storagePath, bytes, {
      contentType: DEFAULT_MIME_TYPE,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return {
    storagePath,
    mimeType: DEFAULT_MIME_TYPE,
  };
}

export async function getChatAudioSignedUrl(scope: ChatScope, messageId: string) {
  const { data, error } = await supabase.functions.invoke<SignedAudioUrlResponse>('get-chat-audio-url', {
    body: { scope, messageId },
  });

  if (error || !data?.url) {
    throw error ?? new Error('Audio-URL konnte nicht geladen werden.');
  }

  return data;
}

export async function deleteChatMessage(scope: ChatScope, messageId: string) {
  const { error } = await supabase.functions.invoke('delete-chat-message', {
    body: { scope, messageId },
  });

  if (error) {
    throw error;
  }
}
