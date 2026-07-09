// Sprach-Logging (Premium) — Aufnahme → KI-Vorschläge → Bestätigen.
//
// Ablauf: Elternteil spricht eine kurze Notiz ein ("Lotti hat um halb drei
// 120 ml Fläschchen getrunken und ich habe sie gewickelt"), die Edge
// Function voice-log-parse transkribiert und extrahiert Einträge, hier
// werden sie zur Bestätigung angezeigt und erst dann gespeichert.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { Colors } from '@/constants/Colors';
import {
  describeVoiceLogEntry,
  parseVoiceRecording,
  saveVoiceLogEntries,
} from '@/lib/voiceLog/api';
import type { VoiceLogParsedEntry } from '@/lib/voiceLog/types';

const MAX_RECORDING_MS = 60_000;
/** Kürzere Aufnahmen gar nicht erst hochladen (Versehens-Taps kosten sonst API-Calls & Rate-Limit). */
const MIN_RECORDING_MS = 1_000;
const VOICE_LOG_MIME_TYPE = 'audio/mp4';
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
} as const;

const ACCENT_LIGHT = '#9C27B0';
const ACCENT_DARK = '#CE93D8';

type Phase = 'idle' | 'recording' | 'processing' | 'review' | 'saving';

type Props = {
  visible: boolean;
  userId?: string | null;
  babyId?: string | null;
  babyName?: string | null;
  onClose: () => void;
  /** Nach erfolgreichem Speichern (Home lädt Einträge/Schlafminuten neu). */
  onSaved: () => void;
};

const formatSeconds = (ms: number) => {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const VoiceLogModal: React.FC<Props> = ({
  visible,
  userId,
  babyId,
  babyName,
  onClose,
  onSaved,
}) => {
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const textSecondary = isDark ? Colors.dark.textSecondary : '#7D5A50';
  const accentColor = isDark ? ACCENT_DARK : ACCENT_LIGHT;
  const overlayColor = isDark ? 'rgba(0,0,0,0.58)' : 'rgba(0,0,0,0.35)';
  const panelColor = isDark ? 'rgba(10,10,12,0.86)' : 'transparent';
  const sectionBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)';
  const sectionBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const recorder = useAudioRecorder(RECORDING_OPTIONS);
  const recorderState = useAudioRecorderState(recorder, 200);

  const [phase, setPhase] = useState<Phase>('idle');
  /** Startzeitpunkt der laufenden Aufnahme (Date.now()) — für die Mindestdauer. */
  const recordingStartedAtRef = useRef(0);
  const [transcript, setTranscript] = useState('');
  const [entries, setEntries] = useState<VoiceLogParsedEntry[]>([]);
  const [selected, setSelected] = useState<boolean[]>([]);

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

  const reset = useCallback(() => {
    setPhase('idle');
    setTranscript('');
    setEntries([]);
    setSelected([]);
  }, []);

  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

  // Beim Schließen/Unmount eine laufende Aufnahme sauber beenden.
  useEffect(() => {
    if (visible) return;
    void recorder.stop().catch(() => {});
    void disableRecordingMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const startRecording = useCallback(async () => {
    if (Platform.OS === 'web' || phase !== 'idle') return;
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Mikrofon', 'Bitte erlaube den Mikrofonzugriff, um Einträge einzusprechen.');
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        interruptionMode: 'duckOthers',
      });
      await recorder.prepareToRecordAsync(RECORDING_OPTIONS);
      recorder.record();
      recordingStartedAtRef.current = Date.now();
      setPhase('recording');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (error) {
      console.error('Failed to start voice log recording:', error);
      await disableRecordingMode();
      Alert.alert('Aufnahme', 'Die Aufnahme konnte nicht gestartet werden.');
      setPhase('idle');
    }
  }, [disableRecordingMode, phase, recorder]);

  const stopAndProcess = useCallback(async () => {
    if (phase !== 'recording') return;
    // Dauer über eigenen Zeitstempel messen — recorderState im useCallback
    // ist ein veralteter Schnappschuss (durationMillis steht nicht in den Deps).
    const durationMs = recordingStartedAtRef.current
      ? Date.now() - recordingStartedAtRef.current
      : 0;
    setPhase('processing');
    const knownUrlBeforeStop = recorderState.url || recorder.uri;
    try {
      await recorder.stop();
    } catch (error) {
      console.error('Failed to stop voice log recording:', error);
    }
    await disableRecordingMode();

    if (durationMs < MIN_RECORDING_MS) {
      Alert.alert(
        'Aufnahme zu kurz',
        'Halte den Moment kurz fest — sprich z. B. was, wann und wie viel passiert ist.',
      );
      setPhase('idle');
      return;
    }

    const localUri = recorder.uri || recorderState.url || knownUrlBeforeStop;
    if (!localUri) {
      Alert.alert('Aufnahme', 'Die Aufnahme konnte nicht gelesen werden.');
      setPhase('idle');
      return;
    }

    try {
      const result = await parseVoiceRecording(localUri, VOICE_LOG_MIME_TYPE, babyName);
      setTranscript(result.transcript);
      setEntries(result.entries);
      setSelected(result.entries.map(() => true));
      setPhase('review');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Die Aufnahme konnte nicht verarbeitet werden.';
      Alert.alert('Sprach-Eintrag', message);
      setPhase('idle');
    }
  }, [babyName, disableRecordingMode, phase, recorder, recorderState.url]);

  // Auto-Stopp am Limit.
  useEffect(() => {
    if (phase !== 'recording') return;
    if (recorderState.durationMillis < MAX_RECORDING_MS) return;
    void stopAndProcess();
  }, [phase, recorderState.durationMillis, stopAndProcess]);

  const cancelRecording = useCallback(async () => {
    try {
      await recorder.stop();
    } catch {
      // no-op
    }
    await disableRecordingMode();
    reset();
  }, [disableRecordingMode, recorder, reset]);

  const toggleEntry = (index: number) => {
    setSelected((current) => current.map((value, i) => (i === index ? !value : value)));
  };

  const selectedEntries = entries.filter((_, index) => selected[index]);

  const handleSave = async () => {
    if (!userId) {
      Alert.alert('Hinweis', 'Bitte melde dich an, um Einträge zu speichern.');
      return;
    }
    if (selectedEntries.length === 0) return;

    setPhase('saving');
    const { savedCount, failedCount } = await saveVoiceLogEntries(
      selectedEntries,
      userId,
      babyId,
    );

    if (savedCount > 0) {
      onSaved();
    }
    if (failedCount > 0) {
      Alert.alert(
        'Sprach-Eintrag',
        savedCount > 0
          ? `${savedCount} Einträge gespeichert, ${failedCount} fehlgeschlagen.`
          : 'Die Einträge konnten nicht gespeichert werden.',
      );
      setPhase(savedCount > 0 ? 'idle' : 'review');
      if (savedCount > 0) onClose();
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onClose();
  };

  const renderIdle = () => (
    <View style={styles.centerBlock}>
      <Text style={[styles.hintText, { color: textSecondary }]}>
        Sprich einfach ein, was passiert ist — z. B.{' '}
        <Text style={{ fontStyle: 'italic' }}>
          „{babyName || 'Sie'} hat um halb drei 120 ml Fläschchen getrunken und ich habe sie
          frisch gewickelt.“
        </Text>
      </Text>
      <TouchableOpacity
        style={[styles.micButton, { backgroundColor: accentColor }]}
        onPress={startRecording}
        activeOpacity={0.8}
      >
        <Text style={styles.micEmoji}>🎙️</Text>
      </TouchableOpacity>
      <Text style={[styles.microHint, { color: textSecondary }]}>Tippen zum Aufnehmen</Text>
    </View>
  );

  const renderRecording = () => (
    <View style={styles.centerBlock}>
      <Text style={[styles.recordingTimer, { color: textPrimary }]}>
        {formatSeconds(recorderState.durationMillis)}
      </Text>
      <Text style={[styles.microHint, { color: textSecondary }]}>
        Aufnahme läuft … (max. 1 Minute)
      </Text>
      <View style={styles.recordingActions}>
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: sectionBorder }]}
          onPress={cancelRecording}
          activeOpacity={0.8}
        >
          <Text style={[styles.secondaryButtonText, { color: textSecondary }]}>Abbrechen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, { backgroundColor: accentColor }]}
          onPress={stopAndProcess}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Fertig</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderProcessing = (label: string) => (
    <View style={styles.centerBlock}>
      <ActivityIndicator size="large" color={accentColor} />
      <Text style={[styles.microHint, { color: textSecondary, marginTop: 16 }]}>{label}</Text>
    </View>
  );

  const renderReview = () => (
    <View>
      {transcript ? (
        <View style={[styles.transcriptBox, { backgroundColor: sectionBg, borderColor: sectionBorder }]}>
          <Text style={[styles.transcriptText, { color: textSecondary }]}>„{transcript}“</Text>
        </View>
      ) : null}

      {entries.length === 0 ? (
        <View style={styles.centerBlock}>
          <Text style={[styles.hintText, { color: textSecondary }]}>
            Ich konnte keinen Eintrag erkennen. Versuch es gern noch einmal mit Zeit und
            Aktivität, z. B. „hat vor einer Stunde geschlafen“.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: accentColor, marginTop: 16 }]}
            onPress={reset}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Neue Aufnahme</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Erkannte Einträge</Text>
          {entries.map((entry, index) => {
            const { emoji, title, timeText } = describeVoiceLogEntry(entry);
            const isActive = selected[index];
            return (
              <TouchableOpacity
                key={`${entry.type}-${index}`}
                style={[
                  styles.entryRow,
                  {
                    backgroundColor: sectionBg,
                    borderColor: isActive ? accentColor : sectionBorder,
                  },
                ]}
                onPress={() => toggleEntry(index)}
                activeOpacity={0.8}
              >
                <Text style={styles.entryEmoji}>{emoji}</Text>
                <View style={styles.entryTextWrap}>
                  <Text style={[styles.entryTitle, { color: textPrimary }]}>{title}</Text>
                  <Text style={[styles.entryTime, { color: textSecondary }]}>
                    {timeText}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </Text>
                </View>
                <Text style={[styles.entryCheck, { color: isActive ? accentColor : textSecondary }]}>
                  {isActive ? '✓' : '○'}
                </Text>
              </TouchableOpacity>
            );
          })}

          <View style={styles.recordingActions}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: sectionBorder }]}
              onPress={reset}
              activeOpacity={0.8}
            >
              <Text style={[styles.secondaryButtonText, { color: textSecondary }]}>
                Neue Aufnahme
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                {
                  backgroundColor: accentColor,
                  opacity: selectedEntries.length === 0 ? 0.5 : 1,
                },
              ]}
              onPress={handleSave}
              disabled={selectedEntries.length === 0}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>
                {selectedEntries.length === 1
                  ? 'Eintrag speichern'
                  : `${selectedEntries.length} Einträge speichern`}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />

        <BlurView
          style={[
            styles.panel,
            {
              backgroundColor: panelColor,
              borderTopWidth: isDark ? 1 : 0,
              borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'transparent',
            },
          ]}
          tint={isDark ? 'dark' : 'extraLight'}
          intensity={80}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.header}>
              <Text style={styles.headerEmoji}>🎙️</Text>
              <View style={styles.headerTitleRow}>
                <Text style={[styles.headerTitle, { color: textPrimary }]}>Per Sprache eintragen</Text>
                <View style={[styles.premiumBadge, { backgroundColor: accentColor }]}>
                  <Text style={styles.premiumBadgeText}>Premium</Text>
                </View>
              </View>
              <Text style={[styles.headerSubtitle, { color: textSecondary }]}>
                Schlaf, Füttern & Windeln einfach einsprechen
              </Text>
            </View>

            {phase === 'idle' && renderIdle()}
            {phase === 'recording' && renderRecording()}
            {phase === 'processing' && renderProcessing('Ich höre mir das kurz an …')}
            {phase === 'saving' && renderProcessing('Einträge werden gespeichert …')}
            {phase === 'review' && renderReview()}
          </ScrollView>
        </BlurView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  panel: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    maxHeight: '82%',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollInner: {
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerEmoji: {
    fontSize: 34,
    marginBottom: 6,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  premiumBadge: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  premiumBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  centerBlock: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  hintText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  micButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  micEmoji: {
    fontSize: 36,
  },
  microHint: {
    fontSize: 13,
    marginTop: 12,
  },
  recordingTimer: {
    fontSize: 40,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  recordingActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  transcriptBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  transcriptText: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 12,
    marginBottom: 8,
  },
  entryEmoji: {
    fontSize: 22,
    marginRight: 10,
  },
  entryTextWrap: {
    flex: 1,
  },
  entryTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  entryTime: {
    fontSize: 12,
    marginTop: 2,
  },
  entryCheck: {
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default VoiceLogModal;
