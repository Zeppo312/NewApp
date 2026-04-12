export type ChatScope = 'direct' | 'group';
export type ChatMessageType = 'text' | 'voice' | 'event';

export const VOICE_MESSAGE_PREVIEW = 'Sprachnachricht';
export const EVENT_MESSAGE_PREVIEW = 'Event';

export type ChatMessageCore = {
  content: string | null;
  message_type: ChatMessageType;
  audio_storage_path: string | null;
  audio_duration_ms: number | null;
  audio_mime_type: string | null;
  event_title?: string | null;
};

export const isVoiceMessage = (
  message: Pick<ChatMessageCore, 'message_type'> | null | undefined,
): boolean => message?.message_type === 'voice';

export const getMessagePreviewText = (
  message: Pick<ChatMessageCore, 'content' | 'message_type' | 'event_title'> | null | undefined,
): string => {
  if (!message) return '';
  if (message.message_type === 'voice') {
    return VOICE_MESSAGE_PREVIEW;
  }
  if (message.message_type === 'event') {
    const title = message.event_title?.trim();
    return title ? `Event: ${title}` : EVENT_MESSAGE_PREVIEW;
  }
  return message.content?.trim() || '';
};

export const formatAudioDuration = (durationMs?: number | null): string => {
  if (!durationMs || durationMs <= 0) return '0:00';
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

export const getAudioProgress = (
  currentSeconds: number,
  durationMs?: number | null,
): number => {
  if (!durationMs || durationMs <= 0) return 0;
  const totalSeconds = durationMs / 1000;
  if (totalSeconds <= 0) return 0;
  return Math.min(1, Math.max(0, currentSeconds / totalSeconds));
};
