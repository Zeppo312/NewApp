import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { MIN_WAKE_MINUTES, type NightWakeCandidate } from '@/lib/sleepNightSplit';
import { useLocale } from '@/contexts/LocaleContext';

const ACCENT = '#4A90E2';
const QUICK_WAKE_OPTIONS = [5, 10, 15];

type EligibleCandidate = Extract<NightWakeCandidate, { eligible: true }>;

type Props = {
  visible: boolean;
  candidate: EligibleCandidate | null;
  feedingStart: Date | null;
  busy?: boolean;
  onPickWake: (wakeMinutes: number) => void;
  onTruncate: () => void;
  onDismiss: () => void;
};

export default function NightWakePrompt({
  visible,
  candidate,
  feedingStart,
  busy = false,
  onPickWake,
  onTruncate,
  onDismiss,
}: Props) {
  const colors = useAdaptiveColors();
  const { locale, localeTag } = useLocale();
  const c = {
    de: { title: 'Nächtliches Füttern erkannt 🌙', subtitle: (time: string) => `Die Fütterung um ${time} liegt im Nachtschlaf. Wachphase eintragen?`, end: 'Nacht hier beenden', minute: 'Min.', dream: 'Traumfüttern — kein Aufwachen' },
    en: { title: 'Night feed detected 🌙', subtitle: (time: string) => `The feed at ${time} falls within night sleep. Log an awake period?`, end: 'End the night here', minute: 'min', dream: 'Dream feed — no waking' },
    es: { title: 'Toma nocturna detectada 🌙', subtitle: (time: string) => `La toma de las ${time} coincide con el sueño nocturno. ¿Registrar un periodo despierto?`, end: 'Terminar aquí la noche', minute: 'min', dream: 'Toma dormido — sin despertar' },
  }[locale];
  const formatTime = (date: Date) => date.toLocaleTimeString(localeTag, { hour: '2-digit', minute: '2-digit' });

  const wakeOptions = useMemo(() => {
    if (!candidate || candidate.truncateOnly) return [];
    const options = [candidate.suggestedWakeMinutes, ...QUICK_WAKE_OPTIONS];
    const seen = new Set<number>();
    return options.filter((minutes) => {
      if (minutes < MIN_WAKE_MINUTES || minutes > candidate.maxSplitWakeMinutes) return false;
      if (seen.has(minutes)) return false;
      seen.add(minutes);
      return true;
    });
  }, [candidate]);

  if (!candidate || !feedingStart) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onDismiss}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.cardBackground || '#FFFFFF' }]} onPress={() => {}}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {c.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {c.subtitle(formatTime(feedingStart))}
          </Text>

          {candidate.truncateOnly ? (
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: ACCENT }]}
              disabled={busy}
              onPress={onTruncate}
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>{c.end}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.chipRow}>
              {wakeOptions.map((minutes, index) => {
                const isSuggested = index === 0 && minutes === candidate.suggestedWakeMinutes;
                return (
                  <TouchableOpacity
                    key={minutes}
                    style={[
                      styles.chip,
                      isSuggested
                        ? { backgroundColor: ACCENT }
                        : { backgroundColor: 'transparent', borderWidth: 1, borderColor: ACCENT },
                    ]}
                    disabled={busy}
                    onPress={() => onPickWake(minutes)}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.chipText, { color: isSuggested ? '#FFFFFF' : ACCENT }]}>
                      {`${minutes} ${c.minute}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <TouchableOpacity
            style={styles.dismissButton}
            disabled={busy}
            onPress={onDismiss}
            accessibilityRole="button"
          >
            <Text style={[styles.dismissText, { color: colors.textSecondary }]}>
              {c.dream}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 34,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  dismissButton: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
