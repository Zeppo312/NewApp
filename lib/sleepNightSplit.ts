import type {
  SleepEntriesService,
  SleepEntry as ServiceSleepEntry,
} from '@/lib/services/SleepEntriesService';
import type { NightWindowSettings } from '@/lib/nightWindowSettings';
import { getSleepPeriodForEntry } from '@/lib/sleepPeriods';
import {
  forgetActiveSleepPeriodOverride,
  loadStoredActiveSleepPeriodOverride,
  rememberActiveSleepPeriodOverride,
} from '@/lib/sleepPeriodOverrides';
import { sleepActivityService } from '@/lib/sleepActivityService';

const MINUTE_MS = 60 * 1000;
const MIN_SEGMENT_MS = MINUTE_MS;
export const MIN_WAKE_MINUTES = 5;
export const DEFAULT_WAKE_MINUTES = 10;
const MAX_RETROACTIVE_FEEDING_MS = 24 * 60 * MINUTE_MS;

export type SplitFailureReason =
  | 'invalid-split-time'
  | 'wake-too-long'
  | 'update-failed'
  | 'create-failed'
  | 'partner-active';

export type SplitNightSegmentResult =
  | {
      ok: true;
      mode: 'split';
      firstEntry: ServiceSleepEntry;
      secondEntry: ServiceSleepEntry;
      secondIsActive: boolean;
      resumedStart: Date;
    }
  | { ok: true; mode: 'truncated'; firstEntry: ServiceSleepEntry }
  | { ok: false; reason: SplitFailureReason; message: string };

// Bewusst weiter gefasst als der Service-Typ: der Tracker arbeitet mit
// lib/sleepData-Entries (Date | string, optionale Felder).
export type SleepEntryLike = {
  id: string;
  user_id?: string | null;
  baby_id?: string | null;
  start_time: string | Date;
  end_time?: string | Date | null;
  duration_minutes?: number | null;
  notes?: string | null;
  quality?: string | null;
  partner_id?: string | null;
};

/**
 * Teilt ein Nachtschlaf-Segment an `splitTime` und legt nach `wakeMinutes`
 * Wachphase ein Folgesegment an (mode 'split'), oder beendet das Segment nur
 * (mode 'truncate'). Reine Datenmutation: Alerts, Busy-State, Cache-Invalidierung
 * und Reloads sind Sache des Aufrufers. Live-Activity-Neustart und die
 * Persistenz des Night-Overrides passieren hier, weil sie an die erzeugte
 * Entry-ID gebunden sind.
 */
export async function splitNightSleepSegment(params: {
  service: SleepEntriesService;
  userId: string;
  targetEntry: SleepEntryLike;
  splitTime: Date;
  wakeMinutes: number;
  mode?: 'split' | 'truncate';
  fallbackPartnerId?: string | null;
  babyId?: string | null;
  babyName?: string | null;
  targetPeriodIsNight?: boolean;
  now?: Date;
}): Promise<SplitNightSegmentResult> {
  const {
    service,
    userId,
    targetEntry,
    splitTime,
    mode = 'split',
    fallbackPartnerId = null,
    babyId = null,
    babyName = null,
    targetPeriodIsNight = true,
    now = new Date(),
  } = params;

  const targetWasActive = !targetEntry.end_time;
  const isPartnerEntry = !!targetEntry.user_id && targetEntry.user_id !== userId;

  if (isPartnerEntry && targetWasActive) {
    return {
      ok: false,
      reason: 'partner-active',
      message: 'Der laufende Schlaf wird auf dem Gerät deines Partners getrackt.',
    };
  }

  const segmentStart = new Date(targetEntry.start_time);
  const segmentEnd = targetEntry.end_time ? new Date(targetEntry.end_time) : now;
  const segmentStartMs = segmentStart.getTime();
  const segmentEndMs = segmentEnd.getTime();
  const splitMs = splitTime.getTime();
  const wakeMinutes = Math.max(0, Math.round(params.wakeMinutes));
  const resumedStart = new Date(splitMs + wakeMinutes * MINUTE_MS);

  if (
    !Number.isFinite(segmentStartMs) ||
    !Number.isFinite(segmentEndMs) ||
    !Number.isFinite(splitMs) ||
    splitMs - segmentStartMs < MIN_SEGMENT_MS ||
    splitMs >= segmentEndMs
  ) {
    return {
      ok: false,
      reason: 'invalid-split-time',
      message: 'Der Teilungszeitpunkt muss innerhalb des Segments liegen.',
    };
  }

  if (mode === 'split' && segmentEndMs - resumedStart.getTime() < MIN_SEGMENT_MS) {
    return {
      ok: false,
      reason: 'wake-too-long',
      message: targetWasActive
        ? 'Die Wachphase darf nicht in der Zukunft enden.'
        : 'Die Wachpause ist zu lang für dieses Segment.',
    };
  }

  const firstDuration = Math.max(1, Math.round((splitMs - segmentStartMs) / MINUTE_MS));
  const originalEndISO = targetEntry.end_time
    ? new Date(targetEntry.end_time).toISOString()
    : null;
  const originalDuration = Number.isFinite(targetEntry.duration_minutes as number)
    ? (targetEntry.duration_minutes as number)
    : targetWasActive
      ? null
      : Math.max(1, Math.round((segmentEndMs - segmentStartMs) / MINUTE_MS));

  const updateResult = await service.updateEntry(targetEntry.id, {
    end_time: splitTime.toISOString(),
    duration_minutes: firstDuration,
  });

  if (updateResult.primary.error || !updateResult.primary.data) {
    console.error('[sleepNightSplit] update error:', updateResult.primary.error);
    return {
      ok: false,
      reason: 'update-failed',
      message: updateResult.primary.error?.message || 'Unbekannter Fehler',
    };
  }
  if (updateResult.secondary.error) {
    console.warn('[sleepNightSplit] secondary backend update failed:', updateResult.secondary.error);
  }

  if (mode === 'truncate') {
    return { ok: true, mode: 'truncated', firstEntry: updateResult.primary.data };
  }

  const secondDuration = targetWasActive
    ? null
    : Math.max(1, Math.round((segmentEndMs - resumedStart.getTime()) / MINUTE_MS));

  const createResult = await service.createEntry({
    user_id: userId,
    baby_id: targetEntry.baby_id ?? babyId ?? null,
    start_time: resumedStart.toISOString(),
    end_time: targetWasActive ? null : segmentEnd.toISOString(),
    duration_minutes: secondDuration,
    notes: targetEntry.notes ?? null,
    quality: targetEntry.quality ?? null,
    // Bei Partner-Segmenten läuft das Folgesegment unter eigener user_id
    // (INSERT-RLS); partner_id zeigt dann auf den Owner des Originals, damit
    // beide Seiten es weiterhin sehen.
    partner_id: isPartnerEntry
      ? targetEntry.user_id ?? null
      : targetEntry.partner_id ?? fallbackPartnerId ?? null,
  });

  if (createResult.primary.error || !createResult.primary.data) {
    console.error('[sleepNightSplit] create error:', createResult.primary.error);

    const rollback = await service.updateEntry(targetEntry.id, {
      end_time: originalEndISO,
      duration_minutes: originalDuration,
    });
    if (rollback.primary.error) {
      console.error('[sleepNightSplit] rollback failed:', rollback.primary.error);
    }

    return {
      ok: false,
      reason: 'create-failed',
      message: createResult.primary.error?.message || 'Unbekannter Fehler',
    };
  }
  if (createResult.secondary.error) {
    console.warn('[sleepNightSplit] secondary backend write failed:', createResult.secondary.error);
  }

  const secondEntry = createResult.primary.data;

  if (targetWasActive) {
    if (targetPeriodIsNight && secondEntry.id) {
      await rememberActiveSleepPeriodOverride(secondEntry.id, 'night', secondEntry.start_time);
    }
    await forgetActiveSleepPeriodOverride(targetEntry.id);

    try {
      await sleepActivityService.startSleepActivity(resumedStart, babyName ?? undefined);
    } catch (liveActivityError) {
      console.error('[sleepNightSplit] failed to restart live activity:', liveActivityError);
    }
  }

  return {
    ok: true,
    mode: 'split',
    firstEntry: updateResult.primary.data,
    secondEntry,
    secondIsActive: targetWasActive,
    resumedStart,
  };
}

export type NightWakeCandidate =
  | {
      eligible: true;
      targetEntry: ServiceSleepEntry;
      targetIsActive: boolean;
      suggestedWakeMinutes: number;
      maxSplitWakeMinutes: number;
      truncateOnly: boolean;
    }
  | {
      eligible: false;
      reason: 'no-containing-night-segment' | 'partner-active' | 'too-old';
    };

/**
 * Prüft, ob eine Fütterung in ein Nachtschlaf-Segment fällt, für das eine
 * Wachphase angeboten werden sollte. Nur der Fütter-START zählt; liegt er in
 * einer bestehenden Wachlücke oder an einer Segmentgrenze (1-Min.-Rand),
 * greift der Skip.
 */
export async function findNightWakeCandidateForFeeding(params: {
  service: SleepEntriesService;
  userId: string;
  babyId?: string | null;
  feedingStart: Date;
  feedingEnd?: Date | null;
  nightWindowSettings: NightWindowSettings;
  now?: Date;
}): Promise<NightWakeCandidate> {
  const {
    service,
    userId,
    babyId,
    feedingStart,
    feedingEnd,
    nightWindowSettings,
    now = new Date(),
  } = params;

  const feedingStartMs = feedingStart.getTime();
  if (!Number.isFinite(feedingStartMs)) {
    return { eligible: false, reason: 'no-containing-night-segment' };
  }
  if (feedingStartMs < now.getTime() - MAX_RETROACTIVE_FEEDING_MS || feedingStartMs > now.getTime()) {
    return { eligible: false, reason: 'too-old' };
  }

  const entriesResult = await service.getEntries(babyId ?? undefined);
  if (entriesResult.error || !entriesResult.data) {
    return { eligible: false, reason: 'no-containing-night-segment' };
  }

  const nowMs = now.getTime();
  const containing = entriesResult.data.find((entry) => {
    if (!entry.id) return false;
    const startMs = new Date(entry.start_time).getTime();
    const endMs = entry.end_time ? new Date(entry.end_time).getTime() : nowMs;
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;
    return startMs + MINUTE_MS <= feedingStartMs && feedingStartMs <= endMs - MINUTE_MS;
  });

  if (!containing) {
    return { eligible: false, reason: 'no-containing-night-segment' };
  }

  const targetIsActive = !containing.end_time;

  let period = getSleepPeriodForEntry(containing, nightWindowSettings, now);
  if (period !== 'night' && targetIsActive) {
    const override = await loadStoredActiveSleepPeriodOverride(containing);
    if (override) period = override;
  }
  if (period !== 'night') {
    return { eligible: false, reason: 'no-containing-night-segment' };
  }

  if (containing.user_id !== userId && targetIsActive) {
    return { eligible: false, reason: 'partner-active' };
  }

  const feedingEndMs = feedingEnd ? feedingEnd.getTime() : null;
  const suggestedFromDuration =
    feedingEndMs !== null && Number.isFinite(feedingEndMs) && feedingEndMs > feedingStartMs
      ? Math.max(MIN_WAKE_MINUTES, Math.ceil((feedingEndMs - feedingStartMs) / MINUTE_MS))
      : null;

  const segmentEndMs = containing.end_time
    ? new Date(containing.end_time).getTime()
    : nowMs;
  const maxSplitWakeMinutes = Math.floor((segmentEndMs - feedingStartMs) / MINUTE_MS) - 1;
  const truncateOnly = maxSplitWakeMinutes < MIN_WAKE_MINUTES;

  // Läuft der Schlaf noch und die Fütterung ist so frisch, dass nicht mal die
  // kleinste Wachphase hineinpasst, ist weder Split noch Truncate sinnvoll.
  if (targetIsActive && truncateOnly) {
    return { eligible: false, reason: 'no-containing-night-segment' };
  }

  const suggestedWakeMinutes = Math.min(
    suggestedFromDuration ?? DEFAULT_WAKE_MINUTES,
    Math.max(MIN_WAKE_MINUTES, maxSplitWakeMinutes)
  );

  return {
    eligible: true,
    targetEntry: containing,
    targetIsActive,
    suggestedWakeMinutes,
    maxSplitWakeMinutes,
    truncateOnly,
  };
}
