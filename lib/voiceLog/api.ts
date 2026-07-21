// Sprach-Logging — Client-Seite: Aufnahme an die Edge Function schicken,
// erkannte Einträge beschreiben und nach Bestätigung über die normalen
// App-Pfade speichern (Füttern/Windel → baby_care_entries, Schlaf →
// sleep_entries — dieselben Wege wie die manuellen Modals auf dem Home-Screen).

import * as FileSystem from 'expo-file-system/legacy';

import { supabase, addBabyCareEntry } from '@/lib/supabase';
import { emitLottiMoment } from '@/lib/lottiMomentEvents';

import { inferRecentMilkPreference } from './feedingPreference';
import { getVoiceLogEntryEmoji } from './presentation';
import { resolveVoiceLogEnd } from './timer';
import type { VoiceLogParsedEntry, VoiceLogParseResult } from './types';

const pad2 = (value: number) => String(value).padStart(2, '0');

/** Lokale Gerätezeit als 'YYYY-MM-DDTHH:mm' — Referenz für relative Zeitangaben. */
const formatLocalDateTime = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(
    date.getHours(),
  )}:${pad2(date.getMinutes())}`;

/** 'YYYY-MM-DDTHH:mm' (lokale Zeit) → Date; null bei ungültigem Format. */
export const localTimeToDate = (local: string | null): Date | null => {
  if (!local || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const [datePart, timePart] = local.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatTime = (date: Date): string =>
  `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

const isSameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatDayPrefix = (date: Date): string => {
  const now = new Date();
  if (isSameLocalDay(date, now)) return '';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDay(date, yesterday)) return 'Gestern, ';
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}., `;
};

const FEEDING_LABELS: Record<string, string> = {
  BREAST: 'Gestillt',
  BOTTLE: 'Fläschchen',
  SOLIDS: 'Beikost',
  PUMP: 'Abgepumpte Milch',
  WATER: 'Wasser/Tee',
};

const SIDE_LABELS: Record<string, string> = {
  LEFT: 'links',
  RIGHT: 'rechts',
  BOTH: 'beide Seiten',
};

const DIAPER_LABELS: Record<string, string> = {
  WET: 'Nass',
  DIRTY: 'Stuhlgang',
  BOTH: 'Nass + Stuhlgang',
};

const fetchRecentMilkPreference = async (
  babyId?: string | null,
): Promise<'BREAST' | 'BOTTLE' | null> => {
  try {
    let query = supabase
      .from('baby_care_entries')
      .select('feeding_type')
      .eq('entry_type', 'feeding')
      .in('feeding_type', ['BREAST', 'BOTTLE'])
      .order('start_time', { ascending: false })
      .limit(5);

    query = babyId ? query.eq('baby_id', babyId) : query.is('baby_id', null);

    const { data, error } = await query;
    if (error) {
      console.error('Failed to load recent feeding preference:', error);
      return null;
    }

    return inferRecentMilkPreference((data ?? []).map((entry) => entry.feeding_type));
  } catch (error) {
    console.error('Failed to resolve recent feeding preference:', error);
    return null;
  }
};

/** Kurzbeschreibung für die Bestätigungs-Liste, z. B. "Fläschchen 120 ml · 14:30". */
export const describeVoiceLogEntry = (
  entry: VoiceLogParsedEntry,
): { emoji: string; title: string; timeText: string } => {
  const start = localTimeToDate(entry.start_local);
  const end = localTimeToDate(entry.end_local);
  const displayEnd =
    start && end && end.getTime() > start.getTime() ? end : null;
  const timeText = start
    ? `${formatDayPrefix(start)}${formatTime(start)}${displayEnd ? ` – ${formatTime(displayEnd)}` : ''}`
    : '';

  if (entry.type === 'sleep') {
    return {
      emoji: getVoiceLogEntryEmoji(entry),
      title: entry.timer_requested ? 'Schlaf · Timer läuft' : 'Schlaf',
      timeText,
    };
  }
  if (entry.type === 'diaper') {
    const diaperType = entry.diaper_type ?? 'WET';
    return {
      emoji: getVoiceLogEntryEmoji(entry),
      title: `Windel · ${DIAPER_LABELS[diaperType] ?? 'Nass'}`,
      timeText,
    };
  }
  const parts = [FEEDING_LABELS[entry.feeding_type ?? ''] ?? 'Fütterung'];
  if (entry.feeding_volume_ml) parts.push(`${entry.feeding_volume_ml} ml`);
  if (entry.feeding_side) parts.push(SIDE_LABELS[entry.feeding_side]);
  if (entry.timer_requested) parts.push('Timer läuft');
  return {
    emoji: getVoiceLogEntryEmoji(entry),
    title: parts.join(' · '),
    timeText,
  };
};

/**
 * Aufnahme transkribieren und in Eintrags-Vorschläge übersetzen.
 * Wirft mit einer nutzerfreundlichen (deutschen) Fehlermeldung.
 */
export const parseVoiceRecording = async (
  localUri: string,
  mimeType: string,
  babyName?: string | null,
  babyId?: string | null,
): Promise<VoiceLogParseResult> => {
  const [audioBase64, recentMilkPreference] = await Promise.all([
    FileSystem.readAsStringAsync(localUri, { encoding: 'base64' }),
    fetchRecentMilkPreference(babyId),
  ]);

  const { data, error } = await supabase.functions.invoke<VoiceLogParseResult>(
    'voice-log-parse',
    {
      body: {
        audioBase64,
        mimeType,
        deviceNow: formatLocalDateTime(new Date()),
        babyName: babyName ?? null,
        recentMilkPreference,
      },
    },
  );

  if (error) {
    console.error('voice-log-parse invoke failed:', error);
    // Bei FunctionsHttpError steckt die Response in error.context — für
    // Rate-Limit (429) & Co. die Server-Meldung anzeigen statt der generischen.
    const response = (error as { context?: Response }).context;
    if (response && typeof response.json === 'function') {
      let body: { message?: string } | null = null;
      try {
        body = (await response.json()) as { message?: string };
      } catch {
        // Body nicht lesbar → generische Meldung unten.
      }
      if (response.status === 429) {
        throw new Error(
          body?.message ??
            'Du hast gerade viele Aufnahmen gemacht. Bitte versuche es später noch einmal.',
        );
      }
      if (response.status === 403) {
        throw new Error('Sprach-Logging ist für dein Konto noch nicht freigeschaltet.');
      }
      if (response.status === 413) {
        throw new Error('Die Aufnahme ist zu lang. Bitte halte dich an maximal eine Minute.');
      }
    }
    throw new Error('Die Aufnahme konnte nicht verarbeitet werden. Bitte versuche es erneut.');
  }
  if (!data || !Array.isArray(data.entries)) {
    throw new Error('Unerwartete Antwort vom Server. Bitte versuche es erneut.');
  }
  return data;
};

export interface VoiceLogSaveResult {
  savedCount: number;
  failedCount: number;
}

/**
 * Bestätigte Einträge speichern — über dieselben Pfade wie die manuellen
 * Modals (inkl. Lotti-Momente; addBabyCareEntry emittiert selbst).
 */
export const saveVoiceLogEntries = async (
  entries: VoiceLogParsedEntry[],
  userId: string,
  babyId?: string | null,
): Promise<VoiceLogSaveResult> => {
  let savedCount = 0;
  let failedCount = 0;

  for (const entry of entries) {
    if (entry.type === 'feeding' && entry.feeding_type_needs_confirmation) {
      failedCount += 1;
      continue;
    }
    const start = localTimeToDate(entry.start_local);
    if (!start) {
      failedCount += 1;
      continue;
    }
    const parsedEnd = localTimeToDate(entry.end_local);
    const end =
      entry.type === 'diaper'
        ? null
        : resolveVoiceLogEnd(start, parsedEnd, entry.timer_requested === true);

    try {
      if (entry.type === 'sleep') {
        const { error } = await supabase.from('sleep_entries').insert({
          user_id: userId,
          baby_id: babyId ?? null,
          start_time: start.toISOString(),
          end_time: end ? end.toISOString() : null,
          quality: null,
          notes: entry.note,
          duration_minutes: end
            ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
            : null,
        });
        if (error) throw error;
        emitLottiMoment('sleep');
      } else {
        const { error } = await addBabyCareEntry(
          {
            entry_type: entry.type,
            start_time: start.toISOString(),
            end_time: end ? end.toISOString() : null,
            notes: entry.note,
            feeding_type: entry.feeding_type,
            feeding_volume_ml: entry.feeding_volume_ml,
            feeding_side: entry.feeding_side,
            diaper_type: entry.diaper_type,
          },
          babyId ?? undefined,
        );
        if (error) throw error;
      }
      savedCount += 1;
    } catch (error) {
      console.error('Failed to save voice log entry:', entry.type, error);
      failedCount += 1;
    }
  }

  return { savedCount, failedCount };
};
