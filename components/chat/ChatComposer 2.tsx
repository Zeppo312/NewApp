import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { formatAudioDuration } from '@/lib/chatMessages';

const MAX_RECORDING_MS = 120_000;
const CHAT_AUDIO_MIME_TYPE = 'audio/mp4';
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
} as const;
const WAVE_BAR_COUNT = 22;

type ChatComposerProps = {
  draft: string;
  onChangeDraft: (value: string) => void;
  sending: boolean;
  onSendText: () => Promise<void> | void;
  onSendVoice: (recording: {
    localUri: string;
    durationMs: number;
    mimeType: string;
  }) => Promise<void>;
  onInputFocus?: () => void;
  replyPreviewSender?: string | null;
  replyPreviewText?: string | null;
  replyPreviewAccentColor?: string;
  onCancelReply?: () => void;
  focusToken?: string | null;
  theme: {
    accent: string;
    text: string;
    textTertiary: string;
  };
  isDark: boolean;
  bottomInset: number;
  leadingAction?: React.ReactNode;
};

type RecorderMode = 'idle' | 'recording' | 'recorded' | 'uploading';

export default function ChatComposer({
  draft,
  onChangeDraft,
  sending,
  onSendText,
  onSendVoice,
  onInputFocus,
  replyPreviewSender,
  replyPreviewText,
  replyPreviewAccentColor,
  onCancelReply,
  focusToken,
  theme,
  isDark,
  bottomInset,
  leadingAction,
}: ChatComposerProps) {
  const inputRef = useRef<TextInput>(null);
  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 200);

  const [recorderMode, setRecorderMode] = useState<RecorderMode>('idle');
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const latestRecordingDurationRef = useRef(0);
  const manualTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const manualTimerStartRef = useRef(0);
  const recorderModeRef = useRef<RecorderMode>('idle');

  useEffect(() => {
    recorderModeRef.current = recorderMode;
  }, [recorderMode]);

  const resetRecording = useCallback(() => {
    if (manualTimerRef.current) {
      clearInterval(manualTimerRef.current);
      manualTimerRef.current = null;
    }
    manualTimerStartRef.current = 0;
    latestRecordingDurationRef.current = 0;
    setRecorderMode('idle');
    setRecordingUri(null);
    setRecordingDurationMs(0);
  }, []);

  const disableRecordingMode = useCallback(async () => {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
      });
    } catch (error) {
      console.error('Failed to reset recording audio mode:', error);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (manualTimerRef.current) {
      clearInterval(manualTimerRef.current);
      manualTimerRef.current = null;
    }
    const manualElapsed = manualTimerStartRef.current > 0
      ? Date.now() - manualTimerStartRef.current
      : 0;
    const finalDurationMs = Math.max(
      manualElapsed,
      latestRecordingDurationRef.current,
      recordingDurationMs,
      recorderState.durationMillis,
    );
    const knownUrlBeforeStop = recorderState.url || recorder.uri || recordingUri;

    try {
      await recorder.stop();
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }

    await disableRecordingMode();

    const localUri = recorder.uri || recorderState.url || knownUrlBeforeStop;
    if (!localUri) {
      resetRecording();
      return;
    }

    const durationMs = finalDurationMs > 0 ? finalDurationMs : 1000;
    setRecordingUri(localUri);
    setRecordingDurationMs(durationMs);
    setRecorderMode('recorded');
  }, [
    disableRecordingMode,
    recorder,
    recorderState.durationMillis,
    recorderState.url,
    recordingDurationMs,
    recordingUri,
    resetRecording,
  ]);

  useEffect(() => {
    if (recorderMode !== 'recording') return;
    const duration = recorderState.durationMillis > 0 ? recorderState.durationMillis : recordingDurationMs;
    if (duration < MAX_RECORDING_MS) return;
    void stopRecording();
  }, [recorderMode, recorderState.durationMillis, recordingDurationMs, stopRecording]);

  useEffect(() => {
    if (recorderMode !== 'recording') return;
    const nativeDuration = recorderState.durationMillis > 0 ? recorderState.durationMillis : 0;
    const manualDuration = manualTimerStartRef.current > 0
      ? Date.now() - manualTimerStartRef.current
      : 0;
    const nextDuration = Math.max(nativeDuration, manualDuration, latestRecordingDurationRef.current);

    if (nativeDuration > latestRecordingDurationRef.current) {
      latestRecordingDurationRef.current = nativeDuration;
    }

    if (nextDuration > 0) {
      setRecordingDurationMs(nextDuration);
    }
  }, [recorderMode, recorderState.durationMillis]);

  useEffect(() => {
    if (!focusToken || recorderMode !== 'idle') return;
    inputRef.current?.focus();
  }, [focusToken, recorderMode]);

  useEffect(() => {
    return () => {
      if (manualTimerRef.current) {
        clearInterval(manualTimerRef.current);
        manualTimerRef.current = null;
      }
      if (recorderModeRef.current === 'recording') {
        void recorder.stop().catch(() => {});
      }
      void disableRecordingMode();
    };
  }, [disableRecordingMode, recorder]);

  const startRecording = useCallback(async () => {
    if (Platform.OS === 'web' || recorderMode !== 'idle') return;

    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Mikrofon', 'Bitte erlaube den Mikrofonzugriff, um Sprachnachrichten aufzunehmen.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
      });

      await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
      recorder.record();
      latestRecordingDurationRef.current = 0;
      setRecordingUri(null);
      setRecordingDurationMs(0);
      manualTimerStartRef.current = Date.now();
      manualTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - manualTimerStartRef.current;
        setRecordingDurationMs((current) => Math.max(current, elapsed));
      }, 200);
      setRecorderMode('recording');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (error) {
      console.error('Failed to start recording:', error);
      await disableRecordingMode();
      Alert.alert('Sprachnachricht', 'Die Aufnahme konnte nicht gestartet werden.');
      resetRecording();
    }
  }, [disableRecordingMode, recorder, recorderMode, resetRecording]);

  const discardRecording = useCallback(async () => {
    if (manualTimerRef.current) {
      clearInterval(manualTimerRef.current);
      manualTimerRef.current = null;
    }
    if (recorderMode === 'recording') {
      try {
        await recorder.stop();
      } catch {
        // no-op
      }
      await disableRecordingMode();
    }
    resetRecording();
  }, [disableRecordingMode, recorder, recorderMode, resetRecording]);

  const sendRecordedVoice = useCallback(async () => {
    if (!recordingUri || recordingDurationMs <= 0 || recorderMode !== 'recorded') return;

    try {
      setRecorderMode('uploading');
      await onSendVoice({
        localUri: recordingUri,
        durationMs: recordingDurationMs,
        mimeType: CHAT_AUDIO_MIME_TYPE,
      });
      resetRecording();
    } catch (error) {
      console.error('Failed to send voice message:', error);
      setRecorderMode('recorded');
      Alert.alert('Sprachnachricht', 'Die Sprachnachricht konnte nicht gesendet werden.');
    }
  }, [onSendVoice, recorderMode, recordingDurationMs, recordingUri, resetRecording]);

  const canSendText = draft.trim().length > 0 && !sending && recorderMode === 'idle';
  const recordingTimer = useMemo(() => {
    const duration = recordingDurationMs;
    return formatAudioDuration(duration);
  }, [recordingDurationMs]);
  const recordingWaveHeights = useMemo(() => {
    const phase = recordingDurationMs / 170;
    const meteringValue = typeof recorderState.metering === 'number'
      ? Math.max(0, Math.min(1, (recorderState.metering + 60) / 60))
      : null;

    return Array.from({ length: WAVE_BAR_COUNT }, (_, index) => {
      const distanceFromCenter = Math.abs(index - (WAVE_BAR_COUNT - 1) / 2) / (WAVE_BAR_COUNT / 2);
      const envelope = 1 - distanceFromCenter * 0.45;
      const fallbackPulse = 0.22 + ((Math.sin(phase + index * 0.62) + 1) / 2) * 0.58;
      const intensity = meteringValue !== null
        ? Math.max(0.16, Math.min(1, meteringValue * envelope + fallbackPulse * 0.28))
        : fallbackPulse * envelope;

      return 4 + intensity * 22;
    });
  }, [recordingDurationMs, recorderState.metering]);

  return (
    <>
      {replyPreviewText && (
        <View
          style={[
            styles.replyPreview,
            {
              backgroundColor: isDark ? '#2A2321' : '#F9F5F1',
              borderTopColor: isDark ? '#3D3330' : '#E8DDD6',
            },
          ]}
        >
          <View
            style={[
              styles.replyPreviewBar,
              { backgroundColor: replyPreviewAccentColor || theme.accent },
            ]}
          />
          <View style={styles.replyPreviewBody}>
            <ThemedText
              style={[
                styles.replyPreviewSender,
                { color: replyPreviewAccentColor || theme.accent },
              ]}
              numberOfLines={1}
            >
              {replyPreviewSender || 'Antwort'}
            </ThemedText>
            <ThemedText
              style={[styles.replyPreviewText, { color: theme.textTertiary }]}
              numberOfLines={1}
            >
              {replyPreviewText}
            </ThemedText>
          </View>
          {onCancelReply ? (
            <TouchableOpacity
              onPress={onCancelReply}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.replyPreviewClose}
            >
              <IconSymbol name="xmark" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      <View
        style={[
          styles.composer,
          {
            backgroundColor: isDark ? '#2A2321' : '#F9F5F1',
            borderTopColor: replyPreviewText ? 'transparent' : isDark ? '#3D3330' : '#E8DDD6',
            paddingBottom: Math.max(bottomInset, Platform.OS === 'ios' ? 6 : 10),
          },
        ]}
      >
        {recorderMode === 'idle' ? (
          <>
            {leadingAction ? <View style={styles.leadingActionSlot}>{leadingAction}</View> : null}
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: isDark ? '#1F1F1F' : '#FFFFFF',
                  borderColor: isDark ? '#3D3330' : '#E8DDD6',
                },
              ]}
            >
              <TextInput
                ref={inputRef}
                style={[styles.input, { color: theme.text }]}
                value={draft}
                onChangeText={onChangeDraft}
                placeholder="Nachricht..."
                placeholderTextColor={theme.textTertiary}
                multiline
                onFocus={onInputFocus}
              />
            </View>

            {draft.trim().length > 0 ? (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: canSendText ? theme.accent : isDark ? '#3D3330' : '#E8DDD6' },
                ]}
                onPress={() => void onSendText()}
                disabled={!canSendText}
                activeOpacity={0.7}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <IconSymbol
                    name="paperplane.fill"
                    size={18}
                    color={canSendText ? '#FFFFFF' : isDark ? '#7A6A60' : '#B0A59E'}
                  />
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: Platform.OS === 'web' ? (isDark ? '#3D3330' : '#E8DDD6') : theme.accent },
                ]}
                onPress={() => void startRecording()}
                disabled={Platform.OS === 'web'}
                activeOpacity={0.8}
              >
                <IconSymbol
                  name="mic.fill"
                  size={18}
                  color={Platform.OS === 'web' ? (isDark ? '#7A6A60' : '#B0A59E') : '#FFFFFF'}
                />
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View
            style={[
              styles.recordingPanel,
              {
                backgroundColor: isDark ? '#1F1F1F' : '#FFFFFF',
                borderColor: isDark ? '#3D3330' : '#E8DDD6',
              },
            ]}
          >
            <View style={styles.recordingInfo}>
              <View style={[styles.recordingDot, { backgroundColor: recorderMode === 'recording' ? '#FF6B6B' : theme.accent }]} />
              <View style={styles.recordingTextBlock}>
                <ThemedText style={[styles.recordingTitle, { color: theme.text }]}>
                  {recorderMode === 'recording' ? 'Aufnahme läuft' : 'Sprachnachricht'}
                </ThemedText>
                <ThemedText style={[styles.recordingTime, { color: theme.textTertiary }]}>
                  {recordingTimer}
                </ThemedText>
                {recorderMode === 'recording' ? (
                  <View
                    style={[
                      styles.recordingWaveShell,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F5EEE9' },
                    ]}
                  >
                    <View style={styles.recordingWave}>
                      {recordingWaveHeights.map((height, index) => (
                        <View
                          key={index}
                          style={[
                            styles.recordingWaveBar,
                            {
                              height,
                              backgroundColor: isDark ? '#F6E9D8' : theme.accent,
                              opacity: 0.38 + (height - 4) / 28,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.recordingActions}>
              <TouchableOpacity
                onPress={() => void discardRecording()}
                style={[styles.smallActionButton, { backgroundColor: isDark ? '#332A28' : '#F3ECE7' }]}
                activeOpacity={0.8}
              >
                <IconSymbol name="trash.fill" size={16} color={theme.textTertiary} />
              </TouchableOpacity>

              {recorderMode === 'recording' ? (
                <TouchableOpacity
                  onPress={() => void stopRecording()}
                  style={[styles.smallActionButton, { backgroundColor: theme.accent }]}
                  activeOpacity={0.8}
                >
                  <IconSymbol name="stop.fill" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => void sendRecordedVoice()}
                  style={[styles.smallActionButton, { backgroundColor: theme.accent }]}
                  activeOpacity={0.8}
                  disabled={recorderMode === 'uploading'}
                >
                  {recorderMode === 'uploading' ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <IconSymbol name="paperplane.fill" size={16} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyPreviewBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 10,
  },
  replyPreviewBody: { flex: 1 },
  replyPreviewSender: { fontSize: 13, fontWeight: '700', marginBottom: 1 },
  replyPreviewText: { fontSize: 13, lineHeight: 17 },
  replyPreviewClose: { padding: 6, marginLeft: 8 },
  composer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 6 : 10,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  leadingActionSlot: {
    marginBottom: Platform.OS === 'ios' ? 1 : 0,
  },
  inputWrapper: { flex: 1, borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  input: {
    minHeight: 42,
    maxHeight: 120,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 10 : 8,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  actionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 1 : 0,
  },
  recordingPanel: {
    flex: 1,
    minHeight: 56,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  recordingTextBlock: {
    flex: 1,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  recordingTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  recordingTime: {
    fontSize: 12,
    marginTop: 2,
  },
  recordingWave: {
    height: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    justifyContent: 'center',
  },
  recordingWaveShell: {
    marginTop: 8,
    height: 34,
    borderRadius: 14,
    paddingHorizontal: 8,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  recordingWaveBar: {
    width: 3,
    borderRadius: 999,
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  smallActionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
