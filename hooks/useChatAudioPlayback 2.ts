import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioStatus } from 'expo-audio';
import { Alert } from 'react-native';

import type { ChatMessageCore, ChatScope } from '@/lib/chatMessages';
import { getChatAudioPlayableSource } from '@/lib/chatAudio';

type AudioCacheEntry = {
  uri: string;
  expiresAt: number;
};

type VoiceMessageLike = Pick<
  ChatMessageCore,
  'message_type' | 'audio_duration_ms'
> & {
  id: string;
};

const CACHE_EARLY_REFRESH_MS = 10_000;
const FINISH_EPSILON_SECONDS = 0.15;

export function useChatAudioPlayback(scope: ChatScope) {
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const cacheRef = useRef(new Map<string, AudioCacheEntry>());
  const activeMessageIdRef = useRef<string | null>(null);
  const finishHandledRef = useRef(false);
  const playbackRateRef = useRef(1);
  const storageAlertShownRef = useRef(false);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [loadingMessageId, setLoadingMessageId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  if (!playerRef.current) {
    playerRef.current = createAudioPlayer(undefined, { updateInterval: 200 });
  }

  useEffect(() => {
    activeMessageIdRef.current = activeMessageId;
  }, [activeMessageId]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || typeof player.addListener !== 'function') {
      return () => {
        playerRef.current?.remove();
      };
    }

    const syncStatus = (status: AudioStatus) => {
      const reachedEnd =
        status.duration > 0 && status.currentTime >= status.duration - FINISH_EPSILON_SECONDS;
      const didFinish = status.didJustFinish || (!status.playing && reachedEnd);

      if (didFinish) {
        setCurrentTime(0);
        setIsPlaying(false);

        if (!finishHandledRef.current) {
          finishHandledRef.current = true;
          player.pause();
          void player.seekTo(0).catch(() => {
            // no-op
          });
          activeMessageIdRef.current = null;
          setActiveMessageId(null);
          setLoadingMessageId(null);
        }

        return;
      }

      finishHandledRef.current = false;
      setCurrentTime(status.currentTime);
      setIsPlaying(status.playing);
    };

    syncStatus(player.currentStatus);
    const subscription = player.addListener('playbackStatusUpdate', syncStatus);

    return () => {
      subscription.remove();
      playerRef.current?.remove();
    };
  }, []);

  const resolvePlayableUrl = useCallback(
    async (messageId: string) => {
      const cached = cacheRef.current.get(messageId);
      if (cached && cached.expiresAt - Date.now() > CACHE_EARLY_REFRESH_MS) {
        return cached.uri;
      }

      const data = await getChatAudioPlayableSource(scope, messageId);
      if (data.warning === 'storage-full' && !storageAlertShownRef.current) {
        storageAlertShownRef.current = true;
        Alert.alert(
          'Speicher fast voll',
          'Auf deinem iPhone ist nicht genug freier Speicher, um Sprachnachrichten lokal zu speichern. Die Nachricht wird deshalb direkt gestreamt.',
        );
      }
      cacheRef.current.set(messageId, {
        uri: data.uri,
        expiresAt: data.expiresAt,
      });

      return data.uri;
    },
    [scope],
  );

  const applyPlaybackRate = useCallback((nextRate: number) => {
    const player = playerRef.current;
    playbackRateRef.current = nextRate;
    setPlaybackRate(nextRate);
    if (!player) return;

    try {
      player.setPlaybackRate(nextRate);
    } catch (error) {
      console.error('Failed to set playback rate:', error);
    }
  }, []);

  const stopPlayback = useCallback(async () => {
    const player = playerRef.current;
    if (!player) return;
    finishHandledRef.current = false;
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
          finishHandledRef.current = false;
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
              applyPlaybackRate(playbackRateRef.current);
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

          finishHandledRef.current = false;
          player.play();
          setIsPlaying(true);
        }
        return;
      }

      setLoadingMessageId(message.id);
      setActiveMessageId(message.id);
      setCurrentTime(0);
      finishHandledRef.current = false;

      try {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
        });

        const url = await resolvePlayableUrl(message.id);
        player.replace({ uri: url });
        applyPlaybackRate(playbackRateRef.current);
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
    [activeMessageId, applyPlaybackRate, resolvePlayableUrl],
  );

  const seekToTime = useCallback(
    async (message: VoiceMessageLike, targetSeconds: number) => {
      if (message.message_type !== 'voice') return;

      const player = playerRef.current;
      if (!player) return;

      const durationSeconds = (message.audio_duration_ms ?? 0) / 1000;
      const maxSeekTarget =
        durationSeconds > 0 ? Math.max(durationSeconds - 0.05, 0) : Number.POSITIVE_INFINITY;
      const nextTime = Math.max(0, Math.min(targetSeconds, maxSeekTarget));
      const isActiveMessage = activeMessageIdRef.current === message.id;

      finishHandledRef.current = false;

      try {
        if (!isActiveMessage) {
          setLoadingMessageId(message.id);
          setActiveMessageId(message.id);
          await setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
            interruptionMode: 'duckOthers',
          });
          const url = await resolvePlayableUrl(message.id);
          player.replace({ uri: url });
          applyPlaybackRate(playbackRateRef.current);
        }

        await player.seekTo(nextTime);
        setCurrentTime(nextTime);
      } catch (error) {
        console.error('Failed to seek chat audio:', error);
        if (!isActiveMessage) {
          setActiveMessageId(null);
        }
      } finally {
        if (!isActiveMessage) {
          setLoadingMessageId(null);
          setIsPlaying(false);
        }
      }
    },
    [applyPlaybackRate, resolvePlayableUrl],
  );

  const cyclePlaybackRate = useCallback(() => {
    const rates = [1, 1.5, 2];
    const currentIndex = rates.findIndex((rate) => rate === playbackRateRef.current);
    const nextRate = rates[(currentIndex + 1) % rates.length] ?? 1;
    applyPlaybackRate(nextRate);
  }, [applyPlaybackRate]);

  return {
    activeMessageId,
    currentTime,
    isPlaying,
    loadingMessageId,
    playbackRate,
    cyclePlaybackRate,
    seekToTime,
    stopPlayback,
    togglePlayback,
  };
}
