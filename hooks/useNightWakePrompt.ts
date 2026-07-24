import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { useBackend } from '@/contexts/BackendContext';
import { useSleepEntriesService } from '@/hooks/useSleepEntriesService';
import { loadNightWindowSettings } from '@/lib/nightWindowSettings';
import { invalidateCacheAfterAction } from '@/lib/screenCache';
import {
  findNightWakeCandidateForFeeding,
  splitNightSleepSegment,
  type NightWakeCandidate,
} from '@/lib/sleepNightSplit';

type EligibleCandidate = Extract<NightWakeCandidate, { eligible: true }>;

type PromptState = {
  candidate: EligibleCandidate;
  feedingStart: Date;
};

export type NightWakeFeeding = {
  startTime: string | Date;
  endTime?: string | Date | null;
  feedingType?: string | null;
};

/**
 * Bietet nach dem Speichern einer Fütterung, die in ein Nachtschlaf-Segment
 * fällt, einen One-Tap-Prompt zum Eintragen einer Wachphase an.
 * `onAfterSplit` läuft nach erfolgreichem Split (Screen-Refresh o. Ä.).
 */
export function useNightWakePrompt(params: {
  userId?: string | null;
  babyId?: string | null;
  babyName?: string | null;
  onAfterSplit?: () => void | Promise<void>;
}) {
  const { userId, babyId, babyName, onAfterSplit } = params;
  const { activeBackend } = useBackend();
  const service = useSleepEntriesService(userId);

  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const [busy, setBusy] = useState(false);

  const maybeOfferNightWake = useCallback(
    async (feeding: NightWakeFeeding) => {
      if (!service || !userId) return;
      // Abpumpen ist eine Eltern-Aktivität — das Baby wacht dafür nicht auf.
      if (feeding.feedingType === 'PUMP') return;

      const feedingStart = new Date(feeding.startTime);
      if (!Number.isFinite(feedingStart.getTime())) return;
      const feedingEnd = feeding.endTime ? new Date(feeding.endTime) : null;

      try {
        const nightWindowSettings = await loadNightWindowSettings(userId);
        const candidate = await findNightWakeCandidateForFeeding({
          service,
          userId,
          babyId,
          feedingStart,
          feedingEnd,
          nightWindowSettings,
        });

        if (candidate.eligible) {
          setPrompt({ candidate, feedingStart });
        }
      } catch (error) {
        console.error('[useNightWakePrompt] detection failed:', error);
      }
    },
    [service, userId, babyId]
  );

  const runSplit = useCallback(
    async (mode: 'split' | 'truncate', wakeMinutes: number) => {
      if (!prompt || !service || !userId || busy) return;
      setBusy(true);
      try {
        const result = await splitNightSleepSegment({
          service,
          userId,
          targetEntry: prompt.candidate.targetEntry,
          splitTime: prompt.feedingStart,
          wakeMinutes,
          mode,
          babyId,
          babyName,
        });

        if (!result.ok) {
          Alert.alert(
            'Wachphase nicht eintragbar',
            result.reason === 'update-failed' || result.reason === 'create-failed'
              ? `Speichern fehlgeschlagen: ${result.message}`
              : result.message
          );
          return;
        }

        setPrompt(null);
        await invalidateCacheAfterAction(`sleep_history_${activeBackend}_${babyId || 'default'}`);
        await onAfterSplit?.();
      } catch (error) {
        console.error('[useNightWakePrompt] split failed:', error);
        Alert.alert('Fehler', 'Die Wachphase konnte nicht eingetragen werden.');
      } finally {
        setBusy(false);
      }
    },
    [prompt, service, userId, busy, babyId, babyName, activeBackend, onAfterSplit]
  );

  const pickWake = useCallback(
    (wakeMinutes: number) => {
      void runSplit('split', wakeMinutes);
    },
    [runSplit]
  );

  const truncateNight = useCallback(() => {
    void runSplit('truncate', 0);
  }, [runSplit]);

  const dismiss = useCallback(() => {
    if (busy) return;
    setPrompt(null);
  }, [busy]);

  return {
    promptVisible: prompt !== null,
    promptCandidate: prompt?.candidate ?? null,
    promptFeedingStart: prompt?.feedingStart ?? null,
    promptBusy: busy,
    maybeOfferNightWake,
    pickWake,
    truncateNight,
    dismissNightWakePrompt: dismiss,
  };
}
