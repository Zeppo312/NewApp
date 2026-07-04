import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';
import { parseSafeDate } from '@/lib/safeDate';
import {
  RecurringExceptionRow,
  RecurringItemRow,
  toDateOnlyISO,
} from '@/services/planner';

const LOTTI_CALENDAR_TITLE = 'Lotti Baby';
const LOTTI_CALENDAR_COLOR = '#8E4EC6';
const DEVICE_INSTALL_ID_KEY = 'planner_calendar_sync_device_install_id';

export type PlannerCalendarSyncSettings = {
  user_id: string;
  device_install_id: string;
  enabled: boolean;
  apple_calendar_id: string | null;
  apple_calendar_title: string | null;
  last_synced_at: string | null;
  sync_past_days: number;
  sync_future_days: number;
};

type SyncKind = 'single' | 'series' | 'occurrence';

type SyncLink = {
  id: string;
  user_id: string;
  device_install_id: string;
  sync_kind: SyncKind;
  planner_item_id: string | null;
  planner_recurring_item_id: string | null;
  planner_recurring_exception_id: string | null;
  occurrence_date: string | null;
  apple_calendar_id: string;
  apple_event_id: string;
  apple_original_event_id: string | null;
  last_planner_updated_at: string | null;
  last_apple_modified_at: string | null;
  last_synced_at: string;
};

type PlannerEventRow = {
  id: string;
  user_id: string;
  day_id: string;
  entry_type: 'event';
  title: string;
  notes: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  is_all_day: boolean | null;
  reminder_minutes: number | null;
  created_at: string;
  updated_at: string;
};

type SyncWindow = {
  start: Date;
  end: Date;
};

type SyncResult = {
  createdPlanner: number;
  updatedPlanner: number;
  deletedPlanner: number;
  createdApple: number;
  updatedApple: number;
  deletedApple: number;
  skipped: number;
  errors: string[];
  lastSyncedAt: string;
};

function createResult(): SyncResult {
  return {
    createdPlanner: 0,
    updatedPlanner: 0,
    deletedPlanner: 0,
    createdApple: 0,
    updatedApple: 0,
    deletedApple: 0,
    skipped: 0,
    errors: [],
    lastSyncedAt: new Date().toISOString(),
  };
}

function makeDeviceInstallId() {
  const random = Math.random().toString(36).slice(2);
  return `device-${Date.now().toString(36)}-${random}`;
}

export async function getPlannerCalendarDeviceInstallId() {
  const existing = await AsyncStorage.getItem(DEVICE_INSTALL_ID_KEY);
  if (existing) return existing;
  const generated = makeDeviceInstallId();
  await AsyncStorage.setItem(DEVICE_INSTALL_ID_KEY, generated);
  return generated;
}

function parseDate(value?: string | Date | null) {
  if (!value) return null;
  return value instanceof Date ? value : parseSafeDate(value);
}

function modifiedIso(event: Calendar.ExpoCalendarEvent) {
  return parseDate(event.lastModifiedDate)?.toISOString() ?? null;
}

function compareIso(a?: string | null, b?: string | null) {
  const aTime = parseDate(a)?.getTime() ?? 0;
  const bTime = parseDate(b)?.getTime() ?? 0;
  if (aTime === bTime) return 0;
  return aTime > bTime ? 1 : -1;
}

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function isoForDateMinutes(dayIso: string, minutes: number) {
  const [year, month, day] = dayIso.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.toISOString();
}

function plannerDayToApple(day: number) {
  return day === 7 ? Calendar.DayOfTheWeek.Sunday : day + 1;
}

function appleDayToPlanner(day: number) {
  return day === Calendar.DayOfTheWeek.Sunday ? 7 : day - 1;
}

function buildSyncWindow(settings: Pick<PlannerCalendarSyncSettings, 'sync_past_days' | 'sync_future_days'>): SyncWindow {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - settings.sync_past_days);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + settings.sync_future_days);
  return { start, end };
}

function buildEventDetails(row: PlannerEventRow) {
  return {
    title: row.title,
    startDate: new Date(row.start_at),
    endDate: new Date(row.end_at),
    allDay: !!row.is_all_day,
    location: row.location ?? undefined,
    notes: row.notes ?? undefined,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    alarms:
      row.reminder_minutes === null || row.reminder_minutes === undefined
        ? []
        : [{ relativeOffset: -Math.max(0, Math.round(row.reminder_minutes)) }],
  };
}

function buildRecurringDetails(row: RecurringItemRow) {
  const start = isoForDateMinutes(row.starts_on, row.is_all_day ? 0 : row.start_at_minutes ?? 0);
  const end = isoForDateMinutes(
    row.starts_on,
    row.is_all_day ? (24 * 60) - 1 : row.end_at_minutes ?? ((row.start_at_minutes ?? 0) + 30),
  );
  return {
    title: row.title,
    startDate: new Date(start),
    endDate: new Date(end),
    allDay: !!row.is_all_day,
    location: row.location ?? undefined,
    notes: row.notes ?? undefined,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    recurrenceRule: {
      frequency: Calendar.Frequency.WEEKLY,
      interval: 1,
      endDate: row.ends_on ? new Date(`${row.ends_on}T23:59:59`) : undefined,
      daysOfTheWeek: row.repeat_days.map((day) => ({
        dayOfTheWeek: plannerDayToApple(day),
      })),
    },
  };
}

function isCompatibleWeeklyRule(rule?: Calendar.RecurrenceRule | null) {
  if (!rule) return false;
  if (rule.frequency !== Calendar.Frequency.WEEKLY) return false;
  if (rule.interval && rule.interval !== 1) return false;
  if (!rule.daysOfTheWeek?.length) return false;
  if (rule.daysOfTheMonth?.length || rule.monthsOfTheYear?.length || rule.weeksOfTheYear?.length) return false;
  return true;
}

function mapAppleEventToPlannerPayload(userId: string, dayId: string, event: Calendar.ExpoCalendarEvent) {
  const start = parseDate(event.startDate) ?? new Date();
  const end = parseDate(event.endDate) ?? new Date(start.getTime() + 30 * 60000);
  return {
    user_id: userId,
    day_id: dayId,
    block_id: null,
    entry_type: 'event' as const,
    title: event.title || 'Termin',
    notes: event.notes ?? null,
    location: event.location ?? null,
    start_at: start.toISOString(),
    end_at: end.toISOString(),
    is_all_day: !!event.allDay,
    reminder_minutes: Array.isArray(event.alarms) && event.alarms.length > 0
      ? Math.abs(Math.round(Number(event.alarms[0]?.relativeOffset ?? -15)))
      : null,
  };
}

function mapAppleEventToRecurringPayload(event: Calendar.ExpoCalendarEvent) {
  const rule = event.recurrenceRule;
  if (!isCompatibleWeeklyRule(rule)) return null;
  const start = parseDate(event.startDate) ?? new Date();
  const end = parseDate(event.endDate) ?? new Date(start.getTime() + 30 * 60000);
  return {
    title: event.title || 'Termin',
    notes: event.notes ?? null,
    location: event.location ?? null,
    is_all_day: !!event.allDay,
    start_at_minutes: event.allDay ? 0 : minutesSinceMidnight(start),
    end_at_minutes: event.allDay ? (24 * 60) - 1 : minutesSinceMidnight(end),
    repeat_days: (rule?.daysOfTheWeek ?? []).map((day) =>
      appleDayToPlanner(day.dayOfTheWeek),
    ),
    starts_on: toDateOnlyISO(start),
    ends_on: rule?.endDate ? toDateOnlyISO(parseDate(rule.endDate) ?? start) : null,
  };
}

function mapAppleEventToRecurringExceptionPayload(
  userId: string,
  recurringItemId: string,
  occurrenceDate: string,
  event: Calendar.ExpoCalendarEvent,
) {
  const start = parseDate(event.startDate) ?? new Date();
  const end = parseDate(event.endDate) ?? new Date(start.getTime() + 30 * 60000);
  return {
    user_id: userId,
    recurring_item_id: recurringItemId,
    day: occurrenceDate,
    deleted: false,
    completed: false,
    title: event.title || 'Termin',
    notes: event.notes ?? null,
    location: event.location ?? null,
    is_all_day: !!event.allDay,
    start_at_minutes: event.allDay ? 0 : minutesSinceMidnight(start),
    end_at_minutes: event.allDay ? (24 * 60) - 1 : minutesSinceMidnight(end),
  };
}

async function ensurePlannerDay(userId: string, date: Date) {
  const dayIso = toDateOnlyISO(date);
  const { data: existing, error: existingError } = await supabase
    .from('planner_days')
    .select('id')
    .eq('user_id', userId)
    .eq('day', dayIso)
    .maybeSingle();
  if (existingError && existingError.code !== 'PGRST116') throw existingError;
  if (existing?.id) return existing.id as string;

  const { data: inserted, error: insertError } = await supabase
    .from('planner_days')
    .insert({ user_id: userId, day: dayIso })
    .select('id')
    .single();
  if (insertError) throw insertError;
  return inserted.id as string;
}

async function getWritableLottiCalendar(existingCalendarId?: string | null) {
  if (Platform.OS !== 'ios') {
    throw new Error('Apple Kalender Sync ist nur auf iOS verfügbar.');
  }

  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  const existingById = existingCalendarId
    ? calendars.find((cal) => cal.id === existingCalendarId && cal.allowsModifications)
    : null;
  if (existingById) return existingById;

  const existingByTitle = calendars.find(
    (cal) => cal.title === LOTTI_CALENDAR_TITLE && cal.allowsModifications,
  );
  if (existingByTitle) return existingByTitle;

  const defaultCalendar =
    typeof Calendar.getDefaultCalendarSync === 'function'
      ? Calendar.getDefaultCalendarSync()
      : calendars.find((cal) => cal.allowsModifications);
  const source = defaultCalendar?.source ?? calendars.find((cal) => cal.source)?.source;

  return Calendar.createCalendar({
    title: LOTTI_CALENDAR_TITLE,
    color: LOTTI_CALENDAR_COLOR,
    entityType: Calendar.EntityTypes.EVENT,
    source,
  });
}

export async function getPlannerCalendarSyncSettings(
  userId: string,
): Promise<PlannerCalendarSyncSettings | null> {
  const deviceInstallId = await getPlannerCalendarDeviceInstallId();
  const { data, error } = await supabase
    .from('planner_calendar_sync_settings')
    .select('user_id,device_install_id,enabled,apple_calendar_id,apple_calendar_title,last_synced_at,sync_past_days,sync_future_days')
    .eq('user_id', userId)
    .eq('device_install_id', deviceInstallId)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return (data as PlannerCalendarSyncSettings | null) ?? null;
}

async function upsertSettings(
  userId: string,
  updates: Partial<PlannerCalendarSyncSettings>,
) {
  const deviceInstallId = await getPlannerCalendarDeviceInstallId();
  const payload = {
    user_id: userId,
    device_install_id: deviceInstallId,
    ...updates,
  };
  const { data, error } = await supabase
    .from('planner_calendar_sync_settings')
    .upsert(payload, { onConflict: 'user_id,device_install_id' })
    .select('user_id,device_install_id,enabled,apple_calendar_id,apple_calendar_title,last_synced_at,sync_past_days,sync_future_days')
    .single();
  if (error) throw error;
  return data as PlannerCalendarSyncSettings;
}

export async function enablePlannerCalendarSync(userId: string) {
  const permission = await Calendar.requestCalendarPermissions(false);
  if (permission.status !== 'granted') {
    throw new Error('Kalenderzugriff wurde nicht erlaubt.');
  }
  const current = await getPlannerCalendarSyncSettings(userId);
  const calendar = await getWritableLottiCalendar(current?.apple_calendar_id);
  return upsertSettings(userId, {
    enabled: true,
    apple_calendar_id: calendar.id,
    apple_calendar_title: calendar.title,
    sync_past_days: current?.sync_past_days ?? 30,
    sync_future_days: current?.sync_future_days ?? 365,
  });
}

export async function disablePlannerCalendarSync(userId: string) {
  return upsertSettings(userId, { enabled: false });
}

async function loadSyncLinks(userId: string, deviceInstallId: string) {
  const { data, error } = await supabase
    .from('planner_calendar_sync_links')
    .select(
      'id,user_id,device_install_id,sync_kind,planner_item_id,planner_recurring_item_id,planner_recurring_exception_id,occurrence_date,apple_calendar_id,apple_event_id,apple_original_event_id,last_planner_updated_at,last_apple_modified_at,last_synced_at',
    )
    .eq('user_id', userId)
    .eq('device_install_id', deviceInstallId);
  if (error) throw error;
  return (data ?? []) as SyncLink[];
}

async function upsertLink(link: Omit<Partial<SyncLink>, 'id'> & {
  user_id: string;
  device_install_id: string;
  sync_kind: SyncKind;
  apple_calendar_id: string;
  apple_event_id: string;
}) {
  const { error } = await supabase
    .from('planner_calendar_sync_links')
    .upsert(
      {
        ...link,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,device_install_id,apple_calendar_id,apple_event_id' },
    );
  if (error) throw error;
}

async function getAppleEvent(eventId: string) {
  try {
    return await Calendar.ExpoCalendarEvent.get(eventId);
  } catch {
    return null;
  }
}

async function loadPlannerEvents(userId: string, window: SyncWindow) {
  const { data, error } = await supabase
    .from('planner_items')
    .select('id,user_id,day_id,entry_type,title,notes,location,start_at,end_at,is_all_day,reminder_minutes,created_at,updated_at')
    .eq('user_id', userId)
    .eq('entry_type', 'event')
    .gte('end_at', window.start.toISOString())
    .lte('start_at', window.end.toISOString());
  if (error) throw error;
  return (data ?? []) as PlannerEventRow[];
}

async function loadRecurring(userId: string, window: SyncWindow) {
  const startIso = toDateOnlyISO(window.start);
  const endIso = toDateOnlyISO(window.end);
  const { data: seriesRows, error: seriesError } = await supabase
    .from('planner_recurring_items')
    .select('id,user_id,entry_type,title,notes,location,assignee,baby_id,is_all_day,due_at_minutes,start_at_minutes,end_at_minutes,repeat_days,starts_on,ends_on,created_at,updated_at')
    .eq('user_id', userId)
    .eq('entry_type', 'event')
    .lte('starts_on', endIso)
    .or(`ends_on.is.null,ends_on.gte.${startIso}`);
  if (seriesError) throw seriesError;

  const seriesIds = ((seriesRows ?? []) as RecurringItemRow[]).map((row) => row.id);
  const { data: exceptionRows, error: exceptionError } = seriesIds.length
    ? await supabase
        .from('planner_recurring_exceptions')
        .select('id,user_id,recurring_item_id,day,deleted,completed,title,notes,location,assignee,baby_id,is_all_day,due_at_minutes,start_at_minutes,end_at_minutes,created_at,updated_at')
        .in('recurring_item_id', seriesIds)
        .gte('day', startIso)
        .lte('day', endIso)
    : { data: [], error: null };
  if (exceptionError) throw exceptionError;
  return {
    series: (seriesRows ?? []) as RecurringItemRow[],
    exceptions: (exceptionRows ?? []) as RecurringExceptionRow[],
  };
}

async function syncPlannerEventsToApple(
  userId: string,
  deviceInstallId: string,
  calendar: Calendar.ExpoCalendar,
  plannerEvents: PlannerEventRow[],
  links: SyncLink[],
  result: SyncResult,
) {
  const linksByPlannerId = new Map(
    links
      .filter((link) => link.sync_kind === 'single' && link.planner_item_id)
      .map((link) => [link.planner_item_id!, link]),
  );
  const plannerIds = new Set(plannerEvents.map((row) => row.id));

  for (const link of linksByPlannerId.values()) {
    if (!link.planner_item_id || plannerIds.has(link.planner_item_id)) continue;
    const { data: existingPlanner, error: existingError } = await supabase
      .from('planner_items')
      .select('id')
      .eq('id', link.planner_item_id)
      .maybeSingle();
    if (existingError && existingError.code !== 'PGRST116') throw existingError;
    if (existingPlanner) continue;
    result.skipped += 1;
  }

  for (const row of plannerEvents) {
    const link = linksByPlannerId.get(row.id);
    if (!link) {
      const event = await calendar.createEvent(buildEventDetails(row));
      await upsertLink({
        user_id: userId,
        device_install_id: deviceInstallId,
        sync_kind: 'single',
        planner_item_id: row.id,
        apple_calendar_id: calendar.id,
        apple_event_id: event.id,
        last_planner_updated_at: row.updated_at,
        last_apple_modified_at: modifiedIso(event),
      });
      result.createdApple += 1;
      continue;
    }

    const apple = await getAppleEvent(link.apple_event_id);
    if (!apple) continue;

    const appleModified = modifiedIso(apple);
    const plannerChanged = compareIso(row.updated_at, link.last_planner_updated_at) > 0;
    const appleChanged = compareIso(appleModified, link.last_apple_modified_at) > 0;

    if (plannerChanged && (!appleChanged || compareIso(row.updated_at, appleModified) >= 0)) {
      await apple.update(buildEventDetails(row));
      await upsertLink({
        ...link,
        last_planner_updated_at: row.updated_at,
        last_apple_modified_at: modifiedIso((await getAppleEvent(link.apple_event_id)) ?? apple),
      });
      result.updatedApple += 1;
    }
  }
}

async function syncPlannerRecurringToApple(
  userId: string,
  deviceInstallId: string,
  calendar: Calendar.ExpoCalendar,
  seriesRows: RecurringItemRow[],
  exceptionRows: RecurringExceptionRow[],
  links: SyncLink[],
  result: SyncResult,
) {
  const linksBySeriesId = new Map(
    links
      .filter((link) => link.sync_kind === 'series' && link.planner_recurring_item_id)
      .map((link) => [link.planner_recurring_item_id!, link]),
  );
  const plannerSeriesIds = new Set(seriesRows.map((row) => row.id));
  const occurrenceLinks = new Map(
    links
      .filter((link) => link.sync_kind === 'occurrence' && link.planner_recurring_item_id && link.occurrence_date)
      .map((link) => [`${link.planner_recurring_item_id}:${link.occurrence_date}`, link]),
  );

  for (const link of linksBySeriesId.values()) {
    if (!link.planner_recurring_item_id || plannerSeriesIds.has(link.planner_recurring_item_id)) continue;
    const { data: existingSeries, error: existingError } = await supabase
      .from('planner_recurring_items')
      .select('id')
      .eq('id', link.planner_recurring_item_id)
      .maybeSingle();
    if (existingError && existingError.code !== 'PGRST116') throw existingError;
    if (existingSeries) continue;
    result.skipped += 1;
  }

  for (const row of seriesRows) {
    const link = linksBySeriesId.get(row.id);
    if (!link) {
      const event = await calendar.createEvent(buildRecurringDetails(row));
      await upsertLink({
        user_id: userId,
        device_install_id: deviceInstallId,
        sync_kind: 'series',
        planner_recurring_item_id: row.id,
        apple_calendar_id: calendar.id,
        apple_event_id: event.id,
        last_planner_updated_at: row.updated_at,
        last_apple_modified_at: modifiedIso(event),
      });
      result.createdApple += 1;
      continue;
    }

    const apple = await getAppleEvent(link.apple_event_id);
    if (!apple) continue;
    const appleModified = modifiedIso(apple);
    const plannerChanged = compareIso(row.updated_at, link.last_planner_updated_at) > 0;
    const appleChanged = compareIso(appleModified, link.last_apple_modified_at) > 0;
    if (plannerChanged && (!appleChanged || compareIso(row.updated_at, appleModified) >= 0)) {
      await apple.update(buildRecurringDetails(row));
      await upsertLink({
        ...link,
        last_planner_updated_at: row.updated_at,
        last_apple_modified_at: modifiedIso((await getAppleEvent(link.apple_event_id)) ?? apple),
      });
      result.updatedApple += 1;
    }
  }

  for (const exception of exceptionRows) {
    const series = seriesRows.find((row) => row.id === exception.recurring_item_id);
    if (!series) continue;
    const occurrenceKey = `${series.id}:${exception.day}`;
    const link = occurrenceLinks.get(occurrenceKey);

    if (exception.deleted) {
      result.skipped += 1;
      continue;
    }

    const startMinutes = exception.is_all_day ? 0 : exception.start_at_minutes ?? series.start_at_minutes ?? 0;
    const endMinutes = exception.is_all_day
      ? (24 * 60) - 1
      : exception.end_at_minutes ?? series.end_at_minutes ?? (startMinutes + 30);
    const pseudoRow: PlannerEventRow = {
      id: exception.id,
      user_id: userId,
      day_id: '',
      entry_type: 'event',
      title: exception.title ?? series.title,
      notes: exception.notes ?? series.notes,
      location: exception.location ?? series.location,
      start_at: isoForDateMinutes(exception.day, startMinutes),
      end_at: isoForDateMinutes(exception.day, endMinutes),
      is_all_day: exception.is_all_day ?? series.is_all_day,
      reminder_minutes: null,
      created_at: exception.created_at ?? series.created_at,
      updated_at: exception.updated_at ?? series.updated_at,
    };

    if (!link) {
      const event = await calendar.createEvent(buildEventDetails(pseudoRow));
      await upsertLink({
        user_id: userId,
        device_install_id: deviceInstallId,
        sync_kind: 'occurrence',
        planner_recurring_item_id: series.id,
        planner_recurring_exception_id: exception.id,
        occurrence_date: exception.day,
        apple_calendar_id: calendar.id,
        apple_event_id: event.id,
        apple_original_event_id: linksBySeriesId.get(series.id)?.apple_event_id ?? null,
        last_planner_updated_at: pseudoRow.updated_at,
        last_apple_modified_at: modifiedIso(event),
      });
      result.createdApple += 1;
    }
  }
}

async function updatePlannerFromAppleEvent(
  userId: string,
  link: SyncLink,
  event: Calendar.ExpoCalendarEvent,
  result: SyncResult,
) {
  const start = parseDate(event.startDate) ?? new Date();
  const dayId = await ensurePlannerDay(userId, start);
  const payload = mapAppleEventToPlannerPayload(userId, dayId, event);

  const { error } = await supabase
    .from('planner_items')
    .update(payload)
    .eq('id', link.planner_item_id);
  if (error) throw error;

  await upsertLink({
    ...link,
    last_planner_updated_at: new Date().toISOString(),
    last_apple_modified_at: modifiedIso(event),
  });
  result.updatedPlanner += 1;
}

async function createPlannerEventFromApple(
  userId: string,
  deviceInstallId: string,
  calendarId: string,
  event: Calendar.ExpoCalendarEvent,
  result: SyncResult,
) {
  const start = parseDate(event.startDate) ?? new Date();
  const dayId = await ensurePlannerDay(userId, start);
  const { data, error } = await supabase
    .from('planner_items')
    .insert(mapAppleEventToPlannerPayload(userId, dayId, event))
    .select('id,updated_at')
    .single();
  if (error) throw error;
  await upsertLink({
    user_id: userId,
    device_install_id: deviceInstallId,
    sync_kind: 'single',
    planner_item_id: data.id,
    apple_calendar_id: calendarId,
    apple_event_id: event.id,
    apple_original_event_id: event.originalId ?? null,
    last_planner_updated_at: data.updated_at,
    last_apple_modified_at: modifiedIso(event),
  });
  result.createdPlanner += 1;
}

async function importAppleSeries(
  userId: string,
  deviceInstallId: string,
  calendarId: string,
  event: Calendar.ExpoCalendarEvent,
  result: SyncResult,
) {
  const rule = event.recurrenceRule;
  if (!isCompatibleWeeklyRule(rule)) {
    await createPlannerEventFromApple(userId, deviceInstallId, calendarId, event, result);
    return;
  }

  const start = parseDate(event.startDate) ?? new Date();
  const end = parseDate(event.endDate) ?? new Date(start.getTime() + 30 * 60000);
  const repeatDays = (rule?.daysOfTheWeek ?? []).map((day) =>
    appleDayToPlanner(day.dayOfTheWeek),
  );
  const { data, error } = await supabase
    .from('planner_recurring_items')
    .insert({
      user_id: userId,
      entry_type: 'event',
      title: event.title || 'Termin',
      notes: event.notes ?? null,
      location: event.location ?? null,
      assignee: 'me',
      is_all_day: !!event.allDay,
      start_at_minutes: event.allDay ? 0 : minutesSinceMidnight(start),
      end_at_minutes: event.allDay ? (24 * 60) - 1 : minutesSinceMidnight(end),
      repeat_days: repeatDays,
      starts_on: toDateOnlyISO(start),
      ends_on: rule?.endDate ? toDateOnlyISO(parseDate(rule.endDate) ?? start) : null,
    })
    .select('id,updated_at')
    .single();
  if (error) throw error;
  await upsertLink({
    user_id: userId,
    device_install_id: deviceInstallId,
    sync_kind: 'series',
    planner_recurring_item_id: data.id,
    apple_calendar_id: calendarId,
    apple_event_id: event.id,
    last_planner_updated_at: data.updated_at,
    last_apple_modified_at: modifiedIso(event),
  });
  result.createdPlanner += 1;
}

async function syncAppleEventsToPlanner(
  userId: string,
  deviceInstallId: string,
  calendarId: string,
  appleEvents: Calendar.ExpoCalendarEvent[],
  links: SyncLink[],
  result: SyncResult,
) {
  const linkByAppleId = new Map(links.map((link) => [link.apple_event_id, link]));
  const appleIds = new Set(appleEvents.map((event) => event.id));

  for (const link of links) {
    if (appleIds.has(link.apple_event_id)) continue;
    const appleStillExists = await getAppleEvent(link.apple_event_id);
    if (appleStillExists) continue;
    result.skipped += 1;
  }

  for (const event of appleEvents) {
    const link = linkByAppleId.get(event.id);
    if (!link) {
      if (event.recurrenceRule) {
        await importAppleSeries(userId, deviceInstallId, calendarId, event, result);
      } else {
        await createPlannerEventFromApple(userId, deviceInstallId, calendarId, event, result);
      }
      continue;
    }

    const appleModified = modifiedIso(event);
    const appleChanged = compareIso(appleModified, link.last_apple_modified_at) > 0;
    if (!appleChanged) continue;

    if (link.sync_kind === 'series' && link.planner_recurring_item_id) {
      const payload = mapAppleEventToRecurringPayload(event);
      if (!payload) {
        result.skipped += 1;
        continue;
      }
      const { data: planner, error } = await supabase
        .from('planner_recurring_items')
        .select('updated_at')
        .eq('id', link.planner_recurring_item_id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      if (!planner) continue;
      const plannerChanged = compareIso(planner.updated_at, link.last_planner_updated_at) > 0;
      if (!plannerChanged || compareIso(appleModified, planner.updated_at) > 0) {
        const { data: updated, error: updateError } = await supabase
          .from('planner_recurring_items')
          .update(payload)
          .eq('id', link.planner_recurring_item_id)
          .select('updated_at')
          .single();
        if (updateError) throw updateError;
        await upsertLink({
          ...link,
          last_planner_updated_at: updated.updated_at,
          last_apple_modified_at: appleModified,
        });
        result.updatedPlanner += 1;
      }
      continue;
    }

    if (
      link.sync_kind === 'occurrence' &&
      link.planner_recurring_item_id &&
      link.occurrence_date
    ) {
      const payload = mapAppleEventToRecurringExceptionPayload(
        userId,
        link.planner_recurring_item_id,
        link.occurrence_date,
        event,
      );
      const { data: existing, error: existingError } = await supabase
        .from('planner_recurring_exceptions')
        .select('id,updated_at')
        .eq('recurring_item_id', link.planner_recurring_item_id)
        .eq('day', link.occurrence_date)
        .maybeSingle();
      if (existingError && existingError.code !== 'PGRST116') throw existingError;
      const plannerChanged = compareIso(existing?.updated_at, link.last_planner_updated_at) > 0;
      if (!plannerChanged || compareIso(appleModified, existing?.updated_at) > 0) {
        const { data: updated, error: upsertError } = await supabase
          .from('planner_recurring_exceptions')
          .upsert(payload, { onConflict: 'recurring_item_id,day' })
          .select('id,updated_at')
          .single();
        if (upsertError) throw upsertError;
        await upsertLink({
          ...link,
          planner_recurring_exception_id: updated.id,
          last_planner_updated_at: updated.updated_at,
          last_apple_modified_at: appleModified,
        });
        result.updatedPlanner += 1;
      }
      continue;
    }

    if (link.sync_kind !== 'single' || !link.planner_item_id) continue;
    const { data: planner, error } = await supabase
      .from('planner_items')
      .select('updated_at')
      .eq('id', link.planner_item_id)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    if (!planner) continue;

    const plannerChanged = compareIso(planner.updated_at, link.last_planner_updated_at) > 0;
    if (!plannerChanged || compareIso(appleModified, planner.updated_at) > 0) {
      await updatePlannerFromAppleEvent(userId, link, event, result);
    }
  }
}

export async function runPlannerCalendarSync(userId: string): Promise<SyncResult> {
  const result = createResult();
  if (Platform.OS !== 'ios') {
    result.errors.push('Apple Kalender Sync ist nur auf iOS verfügbar.');
    return result;
  }

  const deviceInstallId = await getPlannerCalendarDeviceInstallId();
  const settings = await getPlannerCalendarSyncSettings(userId);
  if (!settings?.enabled) return result;

  const permission = await Calendar.getCalendarPermissions(false);
  if (permission.status !== 'granted') {
    result.errors.push('Kalenderzugriff ist nicht erlaubt.');
    return result;
  }

  const calendar = await getWritableLottiCalendar(settings.apple_calendar_id);
  if (calendar.id !== settings.apple_calendar_id || calendar.title !== settings.apple_calendar_title) {
    await upsertSettings(userId, {
      enabled: true,
      apple_calendar_id: calendar.id,
      apple_calendar_title: calendar.title,
      sync_past_days: settings.sync_past_days,
      sync_future_days: settings.sync_future_days,
    });
  }

  const window = buildSyncWindow(settings);
  const links = await loadSyncLinks(userId, deviceInstallId);
  const appleEvents = await Calendar.listEvents([calendar.id], window.start, window.end);

  await syncAppleEventsToPlanner(userId, deviceInstallId, calendar.id, appleEvents, links, result);

  const freshLinks = await loadSyncLinks(userId, deviceInstallId);
  const freshPlannerEvents = await loadPlannerEvents(userId, window);
  const freshRecurring = await loadRecurring(userId, window);

  await syncPlannerEventsToApple(
    userId,
    deviceInstallId,
    calendar,
    freshPlannerEvents,
    freshLinks,
    result,
  );
  await syncPlannerRecurringToApple(
    userId,
    deviceInstallId,
    calendar,
    freshRecurring.series,
    freshRecurring.exceptions,
    freshLinks,
    result,
  );

  const lastSyncedAt = new Date().toISOString();
  result.lastSyncedAt = lastSyncedAt;
  await upsertSettings(userId, {
    enabled: true,
    apple_calendar_id: calendar.id,
    apple_calendar_title: calendar.title,
    last_synced_at: lastSyncedAt,
    sync_past_days: settings.sync_past_days,
    sync_future_days: settings.sync_future_days,
  });
  return result;
}
