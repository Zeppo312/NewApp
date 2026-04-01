import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

import type { ChatMessageCore, ChatScope } from '@/lib/chatMessages';
import { getChatAudioSignedUrl } from '@/lib/chatAudio';

type AudioCacheEntry = {
  url: string;
  expiresAt: number;
};

type VoiceMessageLike = Pick<
  ChatMessageCore,
  'message_type' | 'audio_duration_ms'
> & {
  id: string;
};

const CACHE_EARLY_REFRESH_MS = 10_000;

export function useChatAudioPlayback(scope: ChatScope) {
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const cacheRef = useRef(new Map<string, AudioCacheEntry>());
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [loadingMessageId, setLoadingMessageId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [didFinish, setDidFinish] = useState(false);

  if (!playerRef.current) {
    playerRef.current = createAudioPlayer(undefined, { updateInterval: 200 });
  }

  useEffect(() => {
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const status = player.currentStatus;
      setCurrentTime(player.currentTime);
      setIsPlaying(player.playing);
      setDidFinish(Boolean(status.didJustFinish));
    }, 200);

    return () => {
      clearInterval(interval);
      playerRef.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (!didFinish) return;
    setActiveMessageId(null);
    setLoadingMessageId(null);
    setCurrentTime(0);
    setDidFinish(false);
  }, [didFinish]);

  const resolvePlayableUrl = useCallback(
    async (messageId: string) => {
      const cached = cacheRef.current.get(messageId);
      if (cached && cached.expiresAt - Date.now() > CACHE_EARLY_REFRESH_MS) {
        return cached.url;
      }

      const data = await getChatAudioSignedUrl(scope, messageId);
      cacheRef.current.set(messageId, {
        url: data.url,
        expiresAt: new Date(data.expiresAt).getTime(),
      });

      return data.url;
    },
    [scope],
  );

  const stopPlayback = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    player.pause();
    try {
      await player.seekTo(0);
    } catch {
      // no-op
    }
    setActiveMessageId(null);
    setLoadingMessageId(null);
    setCurrentTime(0);
    setIsPlaying(false);
  }, []);

  const togglePlayback = useCallback(
    async (message: VoiceMessageLike) => {
      if (message.message_type !== 'voice') return;

      const player = playerRef.current;
      if (!player) return;

      if (activeMessageId === message.id) {
        if (player.playing) {
          player.pause();
          setIsPlaying(false);
        } else {
          // Check if the cached signed URL is still valid before resuming.
          // If it expired while paused, fetch a fresh URL and replace the source.
          const cached = cacheRef.current.get(message.id);
          const urlExpired = !cached || cached.expiresAt - Date.now() <= CACHE_EARLY_REFRESH_MS;

          if (urlExpired) {
            try {
              setLoadingMessageId(message.id);
              const freshUrl = await resolvePlayableUrl(message.id);
              player.replace({ uri: freshUrl });
            } catch (error) {
              console.error('Failed to refresh audio URL on resume:', error);
              setActiveMessageId(null);
              setIsPlaying(false);
              setLoadingMessageId(null);
              return;
            } finally {
              setLoadingMessageId(null);
            }
          }

          player.play();
          setIsPlaying(true);
        }
        return;
      }

      setLoadingMessageId(message.id);
      setActiveMessageId(message.id);
      setCurrentTime(0);

      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
        });

        const url = await resolvePlayableUrl(message.id);
        player.replace({ uri: url });
        player.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Failed to play chat audio:', error);
        setActiveMessageId(null);
        setIsPlaying(false);
      } finally {
        setLoadingMessageId(null);
      }
    },
    [activeMessageId, resolvePlayableUrl],
  );

  return {
    activeMessageId,
    currentTime,
    isPlaying,
    loadingMessageId,
    stopPlayback,
    togglePlayback,
  };
}
