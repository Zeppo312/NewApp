/**
 * Lottis Fürsorge – Supabase-Persistenz.
 *
 * Speichert den Tages-Hinweis in `advisor_messages` (1 Zeile pro
 * Nutzer/Baby/Tag) und die Nutzer-Einstellungen in `advisor_settings`.
 *
 * Alle Funktionen sind bewusst fehlertolerant: Existieren die Tabellen
 * (noch) nicht oder ist der Nutzer offline, liefern sie null/Defaults
 * zurück und die Seite fällt auf das bisherige Mock-Verhalten zurück.
 */

import { getCachedUser, supabase } from '@/lib/supabase';

import type { AdvisorAnalysis, AdvisorTone } from './types';

export type AdvisorCategory = 'weather' | 'sleep' | 'feeding' | 'motivation';

export type AdvisorFrequency = 'daily' | 'critical_only' | 'off';

/** Ein gespeicherter Hinweis aus `advisor_messages`. */
export interface AdvisorHistoryItem {
  id: string;
  ruleId: string;
  emoji: string;
  tone: AdvisorTone;
  title: string;
  headline: string | null;
  body: string;
  category: AdvisorCategory;
  localDate: string; // YYYY-MM-DD
  createdAt: string;
  actedAt: string | null;
}

/** Nutzer-Einstellungen aus `advisor_settings`. */
export interface AdvisorSettings {
  enabled: boolean;
  frequency: AdvisorFrequency;
  themes: AdvisorCategory[];
  quietHoursStart: number;
  quietHoursEnd: number;
}

export const ALL_ADVISOR_THEMES: AdvisorCategory[] = [
  'weather',
  'sleep',
  'feeding',
  'motivation',
];

export const DEFAULT_ADVISOR_SETTINGS: AdvisorSettings = {
  enabled: true,
  frequency: 'daily',
  themes: [...ALL_ADVISOR_THEMES],
  quietHoursStart: 21,
  quietHoursEnd: 7,
};

/** Lokales Datum als YYYY-MM-DD (Gerätezeitzone). */
export const localDateString = (date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Kategorie-Zuordnung der Regel-Ids (siehe mockInsights.ts / Konzept §4). */
export const categoryForRule = (ruleId: string): AdvisorCategory => {
  if (ruleId.includes('feeding')) return 'feeding';
  if (ruleId.includes('sleep')) return 'sleep';
  if (ruleId.includes('hot') || ruleId.includes('cold')) return 'weather';
  return 'motivation';
};

/** Priorität wie im Konzept: Kombi-Regeln schlagen Einzel-Regeln. */
export const priorityForRule = (ruleId: string): number => {
  if (ruleId === 'hot_low_feeding' || ruleId === 'hot_low_sleep') return 1;
  if (ruleId === 'hot' || ruleId === 'cold') return 2;
  if (ruleId === 'low_sleep') return 3;
  return 5; // all_good & sonstige Motivation
};

const getUserId = async (): Promise<string | null> => {
  try {
    const { data } = await getCachedUser();
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
};

const rowToHistoryItem = (row: any): AdvisorHistoryItem => ({
  id: row.id,
  ruleId: row.rule_id,
  emoji: row.emoji || '💡',
  tone: (row.tone as AdvisorTone) || 'neutral',
  title: row.title,
  headline: row.headline ?? null,
  body: row.body,
  category: (row.category as AdvisorCategory) || 'motivation',
  localDate: row.local_date,
  createdAt: row.created_at,
  actedAt: row.acted_at ?? null,
});

/**
 * Speichert den heutigen Haupt-Hinweis (Upsert auf user/baby/Tag).
 * Wird die Analyse im Tagesverlauf neu berechnet, aktualisiert sich der
 * Inhalt – read_at/acted_at bleiben dabei erhalten.
 */
export const saveTodayInsight = async (
  babyId: string,
  analysis: AdvisorAnalysis,
): Promise<void> => {
  const userId = await getUserId();
  if (!userId) return;

  const main = analysis.main;
  try {
    await supabase.from('advisor_messages').upsert(
      {
        user_id: userId,
        baby_id: babyId,
        local_date: localDateString(),
        rule_id: main.id,
        title: main.title,
        headline: main.headline ?? null,
        body: main.body,
        emoji: main.emoji,
        tone: main.tone,
        category: categoryForRule(main.id),
        priority: priorityForRule(main.id),
        facts: { reasons: analysis.reasons },
        source: 'rules',
      },
      { onConflict: 'user_id,baby_id,local_date' },
    );
  } catch {
    // Tabelle fehlt / offline – Seite funktioniert ohne Persistenz weiter.
  }
};

/** Verlauf der letzten Tage (ohne heute, ohne verworfene Hinweise). */
export const fetchHistory = async (
  babyId: string,
  limit = 14,
): Promise<AdvisorHistoryItem[] | null> => {
  const userId = await getUserId();
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from('advisor_messages')
      .select(
        'id, rule_id, emoji, tone, title, headline, body, category, local_date, created_at, acted_at',
      )
      .eq('user_id', userId)
      .eq('baby_id', babyId)
      .lt('local_date', localDateString())
      .is('dismissed_at', null)
      .order('local_date', { ascending: false })
      .limit(limit);
    if (error) return null;
    return (data ?? []).map(rowToHistoryItem);
  } catch {
    return null;
  }
};

/** Heutigen Hinweis als gelesen markieren (fürs Ungelesen-Badge). */
export const markTodayRead = async (babyId: string): Promise<void> => {
  const userId = await getUserId();
  if (!userId) return;
  try {
    await supabase
      .from('advisor_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('baby_id', babyId)
      .eq('local_date', localDateString())
      .is('read_at', null);
  } catch {
    // best effort
  }
};

/** „Erledigt"-Haken setzen bzw. entfernen. */
export const setActed = async (
  messageId: string,
  acted: boolean,
): Promise<void> => {
  try {
    await supabase
      .from('advisor_messages')
      .update({ acted_at: acted ? new Date().toISOString() : null })
      .eq('id', messageId);
  } catch {
    // best effort
  }
};

/** Einstellungen laden – fehlen sie, gelten die Defaults. */
export const fetchAdvisorSettings = async (): Promise<AdvisorSettings> => {
  const userId = await getUserId();
  if (!userId) return { ...DEFAULT_ADVISOR_SETTINGS };

  try {
    const { data, error } = await supabase
      .from('advisor_settings')
      .select('enabled, frequency, themes, quiet_hours_start, quiet_hours_end')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_ADVISOR_SETTINGS };
    return {
      enabled: data.enabled ?? true,
      frequency: (data.frequency as AdvisorFrequency) || 'daily',
      themes:
        Array.isArray(data.themes) && data.themes.length > 0
          ? (data.themes as AdvisorCategory[])
          : [...ALL_ADVISOR_THEMES],
      quietHoursStart: data.quiet_hours_start ?? 21,
      quietHoursEnd: data.quiet_hours_end ?? 7,
    };
  } catch {
    return { ...DEFAULT_ADVISOR_SETTINGS };
  }
};

/**
 * Kontext für den täglichen Server-Job (advisor-daily) aktualisieren:
 * Zeitzone immer, Koordinaten nur wenn die Standortfreigabe bereits
 * erteilt ist (kein Prompt). Fire-and-forget beim Öffnen der Seite.
 */
export const updateAdvisorContext = async (): Promise<void> => {
  const userId = await getUserId();
  if (!userId) return;

  const payload: Record<string, unknown> = { user_id: userId };
  try {
    payload.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // Zeitzone nicht ermittelbar – Server-Default bleibt.
  }

  try {
    const Location = await import('expo-location');
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      const pos = await Location.getLastKnownPositionAsync();
      if (pos?.coords) {
        // Auf ~1 km runden – für das Tageswetter reicht das (Datensparsamkeit).
        payload.latitude = Math.round(pos.coords.latitude * 100) / 100;
        payload.longitude = Math.round(pos.coords.longitude * 100) / 100;
        payload.location_updated_at = new Date().toISOString();
      }
    }
  } catch {
    // Standort optional – ohne Koordinaten gibt es serverseitig kein Wetter.
  }

  try {
    await supabase
      .from('advisor_settings')
      .upsert(payload, { onConflict: 'user_id' });
  } catch {
    // best effort
  }
};

/** Einstellungen speichern (Upsert auf user_id). */
export const saveAdvisorSettings = async (
  settings: AdvisorSettings,
): Promise<void> => {
  const userId = await getUserId();
  if (!userId) return;
  try {
    await supabase.from('advisor_settings').upsert(
      {
        user_id: userId,
        enabled: settings.enabled,
        frequency: settings.frequency,
        themes: settings.themes,
        quiet_hours_start: settings.quietHoursStart,
        quiet_hours_end: settings.quietHoursEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
  } catch {
    // best effort
  }
};
