// Sprach-Logging — Client-Seite: Aufnahme an die Edge Function schicken,
// erkannte Einträge beschreiben und nach Bestätigung über die normalen
// App-Pfade speichern (Füttern/Windel/eigene Aktivitäten → baby_care_entries,
// Schlaf → sleep_entries, Einkauf → shopping_list_items — dieselben Wege
// wie die manuellen Modals auf dem Home-Screen bzw. die Einkaufsliste).

import * as FileSystem from 'expo-file-system/legacy';

import { supabase, addBabyCareEntry } from '@/lib/supabase';
import {
  createCustomActivityType,
  getCustomActivityTypes,
  type CustomActivityType,
} from '@/lib/customActivities';
import { normalizeCustomActivityEmoji } from '@/lib/customActivityEmoji';
import { emitLottiMoment } from '@/lib/lottiMomentEvents';
import { upsertShoppingItem } from '@/lib/shopping';
import { refreshShoppingWidget } from '@/lib/shoppingWidget';
import { DailyLocale, getDailyLocaleTag, translateDailyText } from '@/lib/dailyTranslations';

import { inferRecentMilkPreference } from './feedingPreference';
import { getVoiceLogEntryEmoji } from './presentation';
import { resolveVoiceLogEnd } from './timer';
import type { VoiceLogMode, VoiceLogParsedEntry, VoiceLogParseResult } from './types';

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
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  // Auch nicht existente lokale Uhrzeiten beim DST-Sprung ablehnen, statt
  // sie von Date stillschweigend auf die naechste gueltige Stunde zu schieben.
  return !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hours &&
    date.getMinutes() === minutes
    ? date
    : null;
};

const sanitizeCustomActivityName = (value: string): string =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ');

const normalizeCustomActivityName = (value: string): string =>
  sanitizeCustomActivityName(value).toLocaleLowerCase();

const formatTime = (date: Date, locale: DailyLocale): string =>
  date.toLocaleTimeString(getDailyLocaleTag(locale), { hour: '2-digit', minute: '2-digit' });

const isSameLocalDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** "Heute" / "Morgen" / "Fr., 12.09." für Planer-Einträge (auch in der Zukunft). */
const formatPlannerDay = (date: Date, locale: DailyLocale): string => {
  const now = new Date();
  if (isSameLocalDay(date, now)) return translateDailyText(locale, 'voice.today');
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameLocalDay(date, tomorrow)) return translateDailyText(locale, 'voice.tomorrow');
  return date.toLocaleDateString(getDailyLocaleTag(locale), { weekday: 'short', day: '2-digit', month: '2-digit' });
};

const formatDayPrefix = (date: Date, locale: DailyLocale): string => {
  const now = new Date();
  if (isSameLocalDay(date, now)) return '';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDay(date, yesterday)) return translateDailyText(locale, 'voice.yesterday');
  return `${date.toLocaleDateString(getDailyLocaleTag(locale), { day: '2-digit', month: '2-digit' })}, `;
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

/** "2 Packungen" / "1,5 kg" — leer, wenn keine Menge erkannt wurde. */
export const formatShoppingQuantity = (
  entry: Pick<VoiceLogParsedEntry, 'shopping_quantity_value' | 'shopping_quantity_unit'>,
): string => {
  if (entry.shopping_quantity_value === null || entry.shopping_quantity_value === undefined) return '';
  const value = String(entry.shopping_quantity_value).replace('.', ',');
  return entry.shopping_quantity_unit ? `${value} ${entry.shopping_quantity_unit}` : value;
};

/** Kurzbeschreibung für die Bestätigungs-Liste, z. B. "Fläschchen 120 ml · 14:30". */
export const describeVoiceLogEntry = (
  entry: VoiceLogParsedEntry,
  locale: DailyLocale = 'de',
): { emoji: string; title: string; timeText: string } => {
  const t = (key: Parameters<typeof translateDailyText>[1]) => translateDailyText(locale, key);
  const start = localTimeToDate(entry.start_local);
  const end = localTimeToDate(entry.end_local);
  const displayEnd =
    start && end && end.getTime() > start.getTime() ? end : null;
  const timeText = start
    ? `${formatDayPrefix(start, locale)}${formatTime(start, locale)}${displayEnd ? ` – ${formatTime(displayEnd, locale)}` : ''}`
    : '';

  if (entry.type === 'sleep') {
    return {
      emoji: getVoiceLogEntryEmoji(entry),
      title: entry.timer_requested ? t('voice.sleepTimer') : t('voice.sleep'),
      timeText,
    };
  }
  if (entry.type === 'custom') {
    const name = entry.custom_name?.trim() || t('custom.add');
    if (entry.custom_create_type && !entry.custom_log_entry) {
      return {
        emoji: getVoiceLogEntryEmoji(entry),
        title: `${t('custom.newTitle')} · ${name}`,
        timeText: '',
      };
    }
    const details: string[] = [];
    if (entry.custom_tracking_mode === 'quantity' && entry.custom_quantity != null) {
      details.push(
        `${String(entry.custom_quantity).replace('.', ',')}${entry.custom_unit ? ` ${entry.custom_unit}` : ''}`,
      );
    }
    if (entry.timer_requested) details.push(t('input.timerRunning'));
    if (entry.custom_create_type) details.push(t('custom.newTitle'));
    return {
      emoji: getVoiceLogEntryEmoji(entry),
      title: [name, ...details].join(' · '),
      timeText,
    };
  }
  if (entry.type === 'planner') {
    const isTodo = entry.planner_kind === 'todo';
    const dateText = start
      ? entry.planner_all_day
        ? formatPlannerDay(start, locale)
        : `${formatPlannerDay(start, locale)}, ${formatTime(start, locale)}${displayEnd ? ` – ${formatTime(displayEnd, locale)}` : ''}`
      : '';
    return {
      emoji: getVoiceLogEntryEmoji(entry),
      title: `${isTodo ? t('voice.plannerTodo') : t('voice.plannerEvent')} · ${entry.planner_title ?? ''}`,
      timeText: `${dateText}${entry.planner_location ? ` · ${entry.planner_location}` : ''}`,
    };
  }
  if (entry.type === 'shopping') {
    const quantity = formatShoppingQuantity(entry);
    return {
      emoji: getVoiceLogEntryEmoji(entry),
      title: `${t('voice.shopping')} · ${entry.shopping_title ?? ''}${quantity ? ` (${quantity})` : ''}`,
      timeText: '',
    };
  }
  if (entry.type === 'diaper') {
    const diaperType = entry.diaper_type ?? 'WET';
    return {
      emoji: getVoiceLogEntryEmoji(entry),
      title: `${t('voice.diaper')} · ${diaperType === 'DIRTY' ? t('voice.dirty') : diaperType === 'BOTH' ? t('voice.wetDirty') : t('diaper.wet')}`,
      timeText,
    };
  }
  const feedingLabel = entry.feeding_type === 'BREAST' ? t('voice.fedBreast') : entry.feeding_type === 'BOTTLE' ? t('card.bottle') : entry.feeding_type === 'SOLIDS' ? t('feeding.solids') : entry.feeding_type === 'PUMP' ? t('voice.pumpedMilk') : entry.feeding_type === 'WATER' ? t('voice.waterTea') : t('voice.feeding');
  const parts = [feedingLabel];
  if (entry.feeding_volume_ml) parts.push(`${entry.feeding_volume_ml} ml`);
  if (entry.feeding_side) parts.push(entry.feeding_side === 'LEFT' ? t('input.left') : entry.feeding_side === 'RIGHT' ? t('input.right') : t('voice.bothSides'));
  if (entry.timer_requested) parts.push(t('input.timerRunning'));
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
  locale: DailyLocale = 'de',
  mode: VoiceLogMode = 'baby',
): Promise<VoiceLogParseResult> => {
  const t = (key: Parameters<typeof translateDailyText>[1]) => translateDailyText(locale, key);
  const [audioBase64, recentMilkPreference] = await Promise.all([
    FileSystem.readAsStringAsync(localUri, { encoding: 'base64' }),
    mode === 'baby' ? fetchRecentMilkPreference(babyId) : Promise.resolve(null),
  ]);

  const { data, error } = await supabase.functions.invoke<VoiceLogParseResult>(
    'voice-log-parse',
    {
      body: {
        audioBase64,
        mimeType,
        deviceNow: formatLocalDateTime(new Date()),
        locale,
        babyName: babyName ?? null,
        babyId: babyId ?? null,
        recentMilkPreference,
        mode,
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
            t('voice.rateLimit'),
        );
      }
      if (response.status === 403) {
        throw new Error(t('voice.notEnabled'));
      }
      if (response.status === 413) {
        throw new Error(t('voice.tooLong'));
      }
    }
    throw new Error(t('voice.processFailed'));
  }
  if (!data || !Array.isArray(data.entries)) {
    throw new Error(t('voice.serverUnexpected'));
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
  locale: DailyLocale = 'de',
): Promise<VoiceLogSaveResult> => {
  let savedCount = 0;
  let failedCount = 0;
  let savedShoppingCount = 0;
  let savedPlannerCount = 0;

  // Vorlagen nur einmal pro Speichervorgang laden. Bestehende Sprachvorschlaege
  // werden damit direkt vor dem Schreiben erneut gegen RLS und Archivstatus
  // geprueft; Snapshot-Werte aus dem Parser werden nicht blind vertraut.
  let activeCustomActivities: CustomActivityType[] | null = null;
  let customActivitiesLoadError: unknown = null;
  if (babyId && entries.some((entry) => entry.type === 'custom')) {
    const existing = await getCustomActivityTypes(babyId);
    if (existing.error) {
      customActivitiesLoadError = existing.error;
      console.error('Failed to verify custom activities before voice-log save:', existing.error);
    } else {
      activeCustomActivities = existing.data ?? [];
    }
  }

  const resolveCreatedCustomActivity = async (
    entry: VoiceLogParsedEntry,
    targetBabyId: string,
  ): Promise<CustomActivityType | null> => {
    const name = entry.custom_name ? sanitizeCustomActivityName(entry.custom_name) : '';
    const trackingMode = entry.custom_tracking_mode ?? 'event';
    const unit = trackingMode === 'quantity' ? entry.custom_unit?.trim() || null : null;
    if (!name || (trackingMode === 'quantity' && !unit)) return null;

    const alreadyActive = activeCustomActivities?.find(
      (activity) =>
        normalizeCustomActivityName(activity.name) === normalizeCustomActivityName(name),
    );
    if (alreadyActive) return alreadyActive;

    const created = await createCustomActivityType(targetBabyId, {
      name,
      emoji: normalizeCustomActivityEmoji(entry.custom_emoji, name),
      color: entry.custom_color ?? '#5E3DB3',
      tracking_mode: trackingMode,
      unit,
      // Eine gerade diktierte Menge gehoert zum Eintrag, nicht automatisch
      // als dauerhafter Standardwert in die neue Vorlage.
      default_quantity: null,
    });
    if (created.data) {
      activeCustomActivities?.push(created.data);
      return created.data;
    }

    // Zwischen Erkennen und Bestaetigen kann dieselbe Vorlage bereits angelegt
    // worden sein. In diesem Fall den aktiven Namens-Treffer weiterverwenden.
    if ((created.error as { code?: string } | null)?.code === '23505') {
      const existing = await getCustomActivityTypes(targetBabyId);
      if (!existing.error) {
        activeCustomActivities = existing.data ?? [];
        return (
          activeCustomActivities.find(
            (activity) =>
              normalizeCustomActivityName(activity.name) === normalizeCustomActivityName(name),
          ) ?? null
        );
      }
    }
    console.error('Failed to create custom activity from voice log:', created.error);
    return null;
  };

  for (const entry of entries) {
    if (entry.type === 'custom') {
      if (!babyId) {
        failedCount += 1;
        continue;
      }
      try {
        let definition: Pick<
          CustomActivityType,
          'id' | 'name' | 'emoji' | 'color' | 'tracking_mode' | 'unit'
        > | null = null;

        if (entry.custom_activity_type_id && !entry.custom_create_type) {
          if (customActivitiesLoadError || !activeCustomActivities) {
            throw new Error('Custom activities could not be verified');
          }
          definition =
            activeCustomActivities.find(
              (activity) => activity.id === entry.custom_activity_type_id,
            ) ?? null;
          if (!definition) {
            throw new Error('Custom activity is missing or archived');
          }
        }

        if (entry.custom_create_type) {
          if (!entry.custom_name?.trim() || !entry.custom_tracking_mode) {
            throw new Error('Custom activity definition is incomplete');
          }
          definition = await resolveCreatedCustomActivity(entry, babyId);
          if (!definition) throw new Error('Custom activity definition could not be created');
        }

        if (!entry.custom_log_entry) {
          if (!definition) throw new Error('Missing custom activity definition');
          savedCount += 1;
          continue;
        }

        const start = localTimeToDate(entry.start_local);
        if (!definition || !start) throw new Error('Invalid custom activity entry');
        const parsedEnd = localTimeToDate(entry.end_local);
        const end =
          definition.tracking_mode === 'duration'
            ? resolveVoiceLogEnd(start, parsedEnd, entry.timer_requested === true)
            : start;
        if (
          definition.tracking_mode === 'duration' &&
          !entry.timer_requested &&
          (!end || end.getTime() <= start.getTime())
        ) {
          throw new Error('Custom duration requires an end time');
        }
        if (
          definition.tracking_mode === 'quantity' &&
          !(
            typeof entry.custom_quantity === 'number' &&
            Number.isFinite(entry.custom_quantity) &&
            entry.custom_quantity > 0 &&
            entry.custom_quantity <= 999_999_999.999
          )
        ) {
          throw new Error('Custom quantity is missing');
        }

        const { error } = await addBabyCareEntry(
          {
            entry_type: 'custom',
            start_time: start.toISOString(),
            end_time: end?.toISOString() ?? null,
            notes: entry.note,
            custom_activity_type_id: definition.id,
            custom_name: definition.name,
            custom_emoji: definition.emoji,
            custom_color: definition.color,
            custom_tracking_mode: definition.tracking_mode,
            custom_quantity:
              definition.tracking_mode === 'quantity' ? entry.custom_quantity : null,
            custom_unit: definition.tracking_mode === 'quantity' ? definition.unit : null,
          },
          babyId,
        );
        if (error) throw error;
        savedCount += 1;
      } catch (error) {
        console.error('Failed to save voice custom activity:', error);
        failedCount += 1;
      }
      continue;
    }
    if (entry.type === 'planner') {
      const start = localTimeToDate(entry.start_local);
      const title = (entry.planner_title ?? '').trim();
      if (!start || !title) {
        failedCount += 1;
        continue;
      }
      try {
        // Lazy: zieht AuthContext/RevenueCat mit — nicht beim Modul-Import laden.
        const { createPlannerEventForUser, createPlannerTodoForUser } = await import('@/services/planner');
        if (entry.planner_kind === 'todo') {
          await createPlannerTodoForUser(userId, {
            title,
            dueAt: start.toISOString(),
            notes: entry.note,
          });
        } else {
          const end = localTimeToDate(entry.end_local);
          await createPlannerEventForUser(userId, {
            title,
            start: start.toISOString(),
            end: end && end.getTime() > start.getTime() ? end.toISOString() : null,
            location: entry.planner_location,
            isAllDay: entry.planner_all_day,
          });
        }
        savedCount += 1;
        savedPlannerCount += 1;
      } catch (error) {
        console.error('Failed to save voice planner entry:', error);
        failedCount += 1;
      }
      continue;
    }
    if (entry.type === 'shopping') {
      const { error } = await upsertShoppingItem({
        title: entry.shopping_title ?? '',
        category: entry.shopping_category ?? 'other',
        quantity_value: entry.shopping_quantity_value,
        quantity_unit: entry.shopping_quantity_unit,
      });
      if (error) {
        console.error('Failed to save voice shopping item:', error);
        failedCount += 1;
      } else {
        savedCount += 1;
        savedShoppingCount += 1;
      }
      continue;
    }
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

  // Home-Screen-Widget direkt nachziehen — der Einkaufslisten-Screen wird
  // hier ja nicht geöffnet (dort passiert der Sync sonst automatisch).
  if (savedShoppingCount > 0) {
    await refreshShoppingWidget().catch((error) =>
      console.warn('Failed to refresh shopping widget after voice log:', error),
    );
  }
  if (savedPlannerCount > 0) {
    const { refreshPlannerWidget } = await import('@/lib/plannerWidget');
    await refreshPlannerWidget({ userId, locale }).catch((error) =>
      console.warn('Failed to refresh planner widget after voice log:', error),
    );
  }

  return { savedCount, failedCount };
};
