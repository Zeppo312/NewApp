import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import type { ChatScope } from '@/lib/chatMessages';

type SignedAudioUrlResponse = {
  url: string;
  expiresAt: string;
  durationMs: number | null;
  mimeType: string;
};

type ChatAudioPlayableSource = {
  uri: string;
  expiresAt: number;
  isLocal: boolean;
  warning?: 'storage-full';
};

const CHAT_AUDIO_BUCKET = 'chat-audio';
const DEFAULT_MIME_TYPE = 'audio/mp4';
const CHAT_AUDIO_CACHE_DIR = `${FileSystem.cacheDirectory ?? ''}chat-audio/`;
const getAudioCachePath = (scope: ChatScope, messageId: string) =>
  `${CHAT_AUDIO_CACHE_DIR}${scope}-${messageId}.m4a`;

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

const getAudioFileExtension = (mimeType?: string | null) => {
  switch (mimeType) {
    case 'audio/mp4':
    case 'audio/m4a':
    case 'audio/x-m4a':
      return 'm4a';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/aac':
      return 'aac';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav';
    default:
      return 'm4a';
  }
};

const ensureAudioCacheDir = async () => {
  if (!CHAT_AUDIO_CACHE_DIR) return;
  const dirInfo = await FileSystem.getInfoAsync(CHAT_AUDIO_CACHE_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(CHAT_AUDIO_CACHE_DIR, { intermediates: true });
  }
};

const isStorageFullError = (error: unknown) => {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes('no space left on device') ||
    normalized.includes('enospc') ||
    normalized.includes('nsposixerrordomain') ||
    normalized.includes('not enough free space') ||
    normalized.includes('disk full') ||
    normalized.includes('storage full')
  );
};

export async function clearChatAudioCache(scope: ChatScope, messageId: string) {
  if (!CHAT_AUDIO_CACHE_DIR) return;

  const possibleExtensions = ['m4a', 'mp3', 'aac', 'wav'];
  await Promise.allSettled(
    possibleExtensions.map((extension) =>
      FileSystem.deleteAsync(
        `${CHAT_AUDIO_CACHE_DIR}${scope}-${messageId}.${extension}`,
        { idempotent: true },
      ),
    ),
  );
}

export async function getChatAudioPlayableSource(
  scope: ChatScope,
  messageId: string,
): Promise<ChatAudioPlayableSource> {
  if (Platform.OS !== 'web' && CHAT_AUDIO_CACHE_DIR) {
    try {
      await ensureAudioCacheDir();
      const possibleExtensions = ['m4a', 'mp3', 'aac', 'wav'];
      for (const extension of possibleExtensions) {
        const localPath = getAudioCachePath(scope, messageId).replace(/\.m4a$/, `.${extension}`);
        const localInfo = await FileSystem.getInfoAsync(localPath);
        if (localInfo.exists) {
          return {
            uri: localPath,
            expiresAt: Number.MAX_SAFE_INTEGER,
            isLocal: true,
          };
        }
      }
    } catch (error) {
      console.warn('Failed to read local chat audio cache:', error);
    }
  }

  const signed = await getChatAudioSignedUrl(scope, messageId);

  if (Platform.OS === 'web' || !CHAT_AUDIO_CACHE_DIR) {
    return {
      uri: signed.url,
      expiresAt: new Date(signed.expiresAt).getTime(),
      isLocal: false,
    };
  }

  try {
    await ensureAudioCacheDir();
    const extension = getAudioFileExtension(signed.mimeType);
    const localPath = getAudioCachePath(scope, messageId).replace(/\.m4a$/, `.${extension}`);
    const downloadResult = await FileSystem.downloadAsync(signed.url, localPath);
    if (downloadResult.status !== 200) {
      throw new Error(`Audio download failed with status ${downloadResult.status}`);
    }

    return {
      uri: localPath,
      expiresAt: Number.MAX_SAFE_INTEGER,
      isLocal: true,
    };
  } catch (error) {
    console.warn('Falling back to remote chat audio playback:', error);
    return {
      uri: signed.url,
      expiresAt: new Date(signed.expiresAt).getTime(),
      isLocal: false,
      ...(isStorageFullError(error) ? { warning: 'storage-full' as const } : {}),
    };
  }
}

export async function deleteChatMessage(scope: ChatScope, messageId: string) {
  const { error } = await supabase.functions.invoke('delete-chat-message', {
    body: { scope, messageId },
  });

  if (error) {
    throw error;
  }

  await clearChatAudioCache(scope, messageId);
}
