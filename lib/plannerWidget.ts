import { NativeModules, Platform } from 'react-native';

import { getLinkedUsers, supabase } from './supabase';
import { listBabies } from './baby';
import { parseSafeDate } from './safeDate';
import { PRIMARY } from '@/constants/PlannerDesign';
import { normalizePlannerColor } from '@/constants/PlannerColors';
import {
  buildPlannerPersonColorMap,
  resolvePlannerItemColor,
} from './plannerPersonColors';
import {
  convertAssigneePerspective,
  expandRecurringForRange,
  toDateOnlyISO,
  type PlannerItemRow,
  type RecurringExceptionRow,
  type RecurringItemRow,
} from '@/services/planner';
import {
  DEFAULT_PLANNER_LOCALE,
  getPlannerLocaleTag,
  translatePlannerText,
  type PlannerLocale,
  type PlannerTranslationKey,
} from './plannerTranslations';

/**
 * Brücke zu den iOS-Home-Screen-Widgets des Planers (Zeitplan + Aufgaben).
 *
 * App → Widget: `syncPlannerWidget` schreibt einen Tages-Snapshot in die
 * App-Group; beide Widgets lesen daraus.
 * Widget → App: im Aufgaben-Widget abgehakte Aufgaben landen in einer
 * Warteschlange, die `drainPlannerWidgetToggles` beim Aktivieren der App nach
 * Supabase schreibt – auch wenn der Planer selbst nie geöffnet wird.
 *
 * Das Datenformat entspricht `PlannerWidgetSnapshot` in
 * targets/widget/PlannerWidgetStore.swift.
 */

type PlannerWidgetNativeModule = {
  syncSnapshot: (json: string) => Promise<boolean>;
  clearSnapshot: () => Promise<boolean>;
  consumePendingToggles: () => Promise<string>;
  isAvailable: () => Promise<boolean>;
};

const nativeModule: PlannerWidgetNativeModule | null =
  Platform.OS === 'ios' ? (NativeModules.PlannerWidgetModule ?? null) : null;

export const isPlannerWidgetSupported = () => nativeModule !== null;

/** Mehr Zeilen zeigt selbst das große Widget nicht. */
const MAX_EVENTS = 16;
const MAX_TODOS = 16;

export type PlannerWidgetEventInput = {
  id: string;
  title: string;
  /** ISO-Zeitpunkte, wie in PlannerEvent. */
  start: string;
  end: string;
  isAllDay?: boolean;
  /** Bereits aufgelöste Farbe (#rrggbb, Hell-Variante). */
  color: string;
  location?: string | null;
  person?: string | null;
};

export type PlannerWidgetTodoInput = {
  id: string;
  title: string;
  completed: boolean;
  dueAt?: string | null;
  /** Bereits aufgelöste Farbe; fehlt sie bei alten Aufrufern, gilt der Fallback. */
  color?: string | null;
  person?: string | null;
  isRecurring?: boolean;
  seriesId?: string | null;
  occurrenceDate?: string | null;
};

export type PlannerWidgetSnapshot = {
  updatedAt: number;
  dayKey: string;
  dayStart: number;
  localeTag: string;
  events: {
    id: string;
    title: string;
    start: number;
    end: number;
    isAllDay: boolean;
    color: string;
    location: string | null;
    person: string | null;
  }[];
  todos: {
    id: string;
    title: string;
    completed: boolean;
    dueAt: number | null;
    color: string | null;
    person: string | null;
    isRecurring: boolean;
    seriesId: string | null;
    occurrenceDate: string | null;
  }[];
  openTodoCount: number;
  doneTodoCount: number;
  strings: Record<string, string>;
};

type PendingToggle = {
  id: string;
  completed: boolean;
  at: number;
  seriesId?: string | null;
  occurrenceDate?: string | null;
};

const seconds = (value: string | Date | null | undefined): number | null => {
  const date = value instanceof Date ? value : parseSafeDate(value ?? null);
  if (!date || Number.isNaN(date.getTime())) return null;
  return Math.round(date.getTime() / 1000);
};

const startOfDay = (date: Date) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const buildStrings = (locale: PlannerLocale): Record<string, string> => {
  const t = (key: PlannerTranslationKey) => translatePlannerText(locale, key);
  // Swift setzt Zahlen per String(format:) ein, deshalb {{count}} → %d.
  const counted = (key: PlannerTranslationKey) => t(key).replace('{{count}}', '%d');
  return {
    timelineTitle: t('widget.timelineTitle'),
    tasksTitle: t('widget.tasksTitle'),
    openLabel: t('widget.open'),
    doneLabel: t('widget.done'),
    flexibleLabel: t('widget.flexible'),
    allDayLabel: t('widget.allDay'),
    nowLabel: t('widget.now'),
    noEventsTitle: t('widget.noEventsTitle'),
    noEventsHint: t('widget.noEventsHint'),
    noMoreEventsTitle: t('widget.noMoreEvents'),
    noTasksTitle: t('widget.noTasksTitle'),
    noTasksHint: t('widget.noTasksHint'),
    moreItems: counted('widget.moreItems'),
    eventsCount: counted('widget.eventsCount'),
    signedOut: t('widget.signedOut'),
    staleHint: t('widget.staleHint'),
    addTask: t('widget.addTask'),
  };
};

/**
 * Baut den Snapshot aus bereits aufgelösten Einträgen. Die Reihenfolge der
 * Aufgaben ist die Widget-Reihenfolge: offene mit Uhrzeit, dann offene ohne
 * Datum, zuletzt heute Erledigte – das Widget sortiert bewusst nicht um.
 */
export const buildPlannerWidgetSnapshot = (
  input: {
    events: PlannerWidgetEventInput[];
    todos: PlannerWidgetTodoInput[];
    locale?: PlannerLocale;
    now?: Date;
  },
): PlannerWidgetSnapshot => {
  const now = input.now ?? new Date();
  const locale = input.locale ?? DEFAULT_PLANNER_LOCALE;
  const dayStart = startOfDay(now);

  const events = input.events
    .reduce<PlannerWidgetSnapshot['events']>((acc, event) => {
      const start = seconds(event.start);
      const end = seconds(event.end) ?? start;
      if (start == null || end == null) return acc;
      acc.push({
        id: event.id,
        title: event.title,
        start,
        end: Math.max(start, end),
        isAllDay: !!event.isAllDay,
        color: normalizePlannerColor(event.color) ?? normalizePlannerColor(PRIMARY) ?? PRIMARY,
        location: event.location?.trim() || null,
        person: event.person?.trim() || null,
      });
      return acc;
    }, [])
    .sort((a, b) => {
      if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
      return a.start - b.start;
    })
    .slice(0, MAX_EVENTS);

  const mapTodo = (todo: PlannerWidgetTodoInput): PlannerWidgetSnapshot['todos'][number] => ({
    id: todo.id,
    title: todo.title,
    completed: !!todo.completed,
    dueAt: seconds(todo.dueAt ?? null),
    color: normalizePlannerColor(todo.color) ?? normalizePlannerColor(PRIMARY) ?? PRIMARY,
    person: todo.person?.trim() || null,
    isRecurring: !!todo.isRecurring,
    seriesId: todo.seriesId ?? null,
    occurrenceDate: todo.occurrenceDate ?? null,
  });

  const mapped = input.todos.map(mapTodo);
  const openTimed = mapped
    .filter((todo) => !todo.completed && todo.dueAt != null)
    .sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  const openFlexible = mapped.filter((todo) => !todo.completed && todo.dueAt == null);
  const done = mapped.filter((todo) => todo.completed);
  const todos = [...openTimed, ...openFlexible, ...done].slice(0, MAX_TODOS);

  return {
    updatedAt: Math.round(now.getTime() / 1000),
    dayKey: toDateOnlyISO(dayStart),
    dayStart: Math.round(dayStart.getTime() / 1000),
    localeTag: getPlannerLocaleTag(locale),
    events,
    todos,
    openTodoCount: openTimed.length + openFlexible.length,
    doneTodoCount: done.length,
    strings: buildStrings(locale),
  };
};

/** Schreibt einen fertigen Snapshot ins Widget. */
export const syncPlannerWidget = async (snapshot: PlannerWidgetSnapshot): Promise<void> => {
  if (!nativeModule) return;
  try {
    await nativeModule.syncSnapshot(JSON.stringify(snapshot));
  } catch (error) {
    console.warn('Failed to sync planner widget:', error);
  }
};

/** Leert das Widget, z. B. beim Abmelden. */
export const clearPlannerWidget = async (): Promise<void> => {
  if (!nativeModule) return;
  try {
    await nativeModule.clearSnapshot();
  } catch (error) {
    console.warn('Failed to clear planner widget:', error);
  }
};

// MARK: Eigenständiges Laden (ohne geöffneten Planer-Screen)

type LinkedUser = {
  userId: string;
  firstName?: string | null;
  lastName?: string | null;
  userRole?: string | null;
};

const displayNameForLinkedUser = (linkedUser: LinkedUser, fallback: string) => {
  const firstName = linkedUser.firstName?.trim();
  const lastName = linkedUser.lastName?.trim();
  if (firstName && lastName) return `${firstName} ${lastName.charAt(0)}.`;
  if (firstName) return firstName;
  if (lastName) return lastName;
  const role = linkedUser.userRole?.trim();
  if (role) return role;
  return fallback;
};

const ITEM_COLUMNS =
  'id,user_id,day_id,block_id,entry_type,title,completed,assignee,baby_id,notes,location,due_at,start_at,end_at,is_all_day,reminder_minutes,color,created_at,updated_at';

/**
 * Lädt den heutigen Planer-Stand direkt aus Supabase und schreibt ihn ins
 * Widget. Dieselben Abfragen wie im Planer (usePlannerDay + Wochenansicht),
 * damit Widget und App denselben Tag zeigen – inklusive Partner-Einträgen und
 * wiederkehrenden Serien.
 */
export const refreshPlannerWidget = async (
  options: { userId: string; locale?: PlannerLocale; now?: Date },
): Promise<PlannerWidgetSnapshot | null> => {
  if (!nativeModule) return null;
  const { userId } = options;
  const locale = options.locale ?? DEFAULT_PLANNER_LOCALE;
  const now = options.now ?? new Date();
  const t = (key: PlannerTranslationKey) => translatePlannerText(locale, key);

  try {
    const dayStart = startOfDay(now);
    const dayIso = toDateOnlyISO(dayStart);

    const [linkedResult, babiesResult] = await Promise.all([
      getLinkedUsers(userId).catch(() => null),
      listBabies().catch(() => ({ data: null })),
    ]);
    const linkedUsers: LinkedUser[] = Array.isArray(linkedResult?.linkedUsers)
      ? (linkedResult.linkedUsers as any[])
          .filter((entry) => typeof entry?.userId === 'string' && entry.userId.length > 0)
          .map(
            (entry): LinkedUser => ({
              userId: entry.userId,
              firstName: entry?.firstName ?? null,
              lastName: entry?.lastName ?? null,
              userRole: entry?.userRole ?? null,
            }),
          )
      : [];
    const babies = ((babiesResult as any)?.data ?? []) as { id?: string; name?: string | null; baby_gender?: string | null }[];
    const ownerIds = Array.from(new Set([userId, ...linkedUsers.map((entry) => entry.userId)]));

    const [itemsResult, seriesResult, floatingOpenResult, floatingDoneResult] = await Promise.all([
      supabase
        .from('planner_items')
        .select(`${ITEM_COLUMNS},planner_days!inner(day)`)
        .in('user_id', ownerIds)
        .eq('planner_days.day', dayIso),
      supabase
        .from('planner_recurring_items')
        .select(
          'id,user_id,entry_type,title,notes,location,assignee,baby_id,is_all_day,due_at_minutes,start_at_minutes,end_at_minutes,repeat_days,starts_on,ends_on,color,created_at,updated_at',
        )
        .in('user_id', ownerIds)
        .lte('starts_on', dayIso),
      supabase
        .from('planner_items')
        .select(ITEM_COLUMNS)
        .in('user_id', ownerIds)
        .is('due_at', null)
        .eq('entry_type', 'todo')
        .eq('completed', false)
        .order('created_at', { ascending: true }),
      supabase
        .from('planner_items')
        .select(ITEM_COLUMNS)
        .in('user_id', ownerIds)
        .is('due_at', null)
        .eq('entry_type', 'todo')
        .eq('completed', true)
        .gte('updated_at', dayStart.toISOString())
        .order('updated_at', { ascending: false })
        .limit(50),
    ]);
    if (itemsResult.error) throw itemsResult.error;
    if (seriesResult.error) throw seriesResult.error;
    if (floatingOpenResult.error) throw floatingOpenResult.error;
    if (floatingDoneResult.error) throw floatingDoneResult.error;

    const activeSeries = ((seriesResult.data ?? []) as RecurringItemRow[]).filter(
      (series) => !series.ends_on || series.ends_on >= dayIso,
    );
    let exceptions: RecurringExceptionRow[] = [];
    if (activeSeries.length > 0) {
      const { data, error } = await supabase
        .from('planner_recurring_exceptions')
        .select(
          'id,user_id,recurring_item_id,day,deleted,completed,title,notes,location,assignee,baby_id,is_all_day,due_at_minutes,start_at_minutes,end_at_minutes,color,created_at,updated_at',
        )
        .in('recurring_item_id', activeSeries.map((series) => series.id))
        .eq('day', dayIso);
      if (error) throw error;
      exceptions = (data ?? []) as RecurringExceptionRow[];
    }
    const recurringRows = expandRecurringForRange(dayStart, dayStart, activeSeries, exceptions, userId).get(dayIso) ?? [];

    const dayRows = [...((itemsResult.data ?? []) as PlannerItemRow[]), ...recurringRows];
    const seen = new Set<string>();
    const uniqueDayRows = dayRows.filter((row) => {
      if (!row?.id || seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });

    const partnerUserId = linkedUsers.find((entry) => entry.userId !== userId)?.userId ?? null;
    const colorMap = buildPlannerPersonColorMap({
      userId,
      linkedUserIds: linkedUsers.map((entry) => entry.userId),
      babies,
      accentColor: PRIMARY,
    });
    const nameByUserId = new Map(
      linkedUsers.map((entry) => [entry.userId, displayNameForLinkedUser(entry, t('person.partner'))]),
    );
    const babyNameById = new Map(babies.filter((baby) => baby.id).map((baby) => [baby.id as string, baby.name ?? null]));

    const personLabel = (row: PlannerItemRow): string | null => {
      const assignee = convertAssigneePerspective(row.assignee, row.user_id, userId);
      if (assignee === 'partner') {
        return partnerUserId ? nameByUserId.get(partnerUserId) ?? t('person.partner') : t('person.partner');
      }
      if (assignee === 'child') {
        return (row.baby_id ? babyNameById.get(row.baby_id) : null) ?? t('person.child');
      }
      if (assignee === 'family') return t('person.family');
      if (row.user_id && row.user_id !== userId) return nameByUserId.get(row.user_id) ?? t('person.partner');
      return null;
    };
    const colorFor = (row: PlannerItemRow) =>
      resolvePlannerItemColor(
        {
          assignee: convertAssigneePerspective(row.assignee, row.user_id, userId),
          babyId: row.baby_id,
          ownerId: row.user_id,
          color: row.color,
        },
        colorMap,
        { userId, partnerUserId, fallback: PRIMARY },
      );

    const events: PlannerWidgetEventInput[] = uniqueDayRows
      .filter((row) => row.entry_type === 'event' && row.start_at)
      .map((row) => ({
        id: row.id,
        title: row.title,
        start: row.start_at as string,
        end: row.end_at ?? (row.start_at as string),
        isAllDay: !!row.is_all_day,
        color: colorFor(row),
        location: row.location,
        person: personLabel(row),
      }));

    const todoFromRow = (row: PlannerItemRow): PlannerWidgetTodoInput => ({
      id: row.id,
      title: row.title,
      completed: !!row.completed,
      dueAt: row.due_at,
      color: colorFor(row),
      person: personLabel(row),
      isRecurring: !!row.is_recurring,
      seriesId: row.recurring_series_id ?? null,
      occurrenceDate: row.recurring_occurrence_date ?? null,
    });

    const todos: PlannerWidgetTodoInput[] = [
      ...uniqueDayRows.filter((row) => row.entry_type === 'todo' && row.due_at).map(todoFromRow),
      ...((floatingOpenResult.data ?? []) as PlannerItemRow[]).map(todoFromRow),
      ...((floatingDoneResult.data ?? []) as PlannerItemRow[]).map(todoFromRow),
    ];

    const snapshot = buildPlannerWidgetSnapshot({ events, todos, locale, now });
    await syncPlannerWidget(snapshot);
    return snapshot;
  } catch (error) {
    console.warn('Failed to refresh planner widget:', error);
    return null;
  }
};

// MARK: Widget → App

const readPendingToggles = async (): Promise<PendingToggle[]> => {
  if (!nativeModule) return [];
  try {
    const raw = await nativeModule.consumePendingToggles();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingToggle[]) : [];
  } catch (error) {
    console.warn('Failed to read pending planner widget toggles:', error);
    return [];
  }
};

/**
 * Setzt den Erledigt-Status einer wiederkehrenden Aufgabe für einen Tag –
 * als Ausnahme der Serie, wie toggleRecurringTodo in services/planner.ts.
 * Anders als dort wird der Zielzustand gesetzt statt umgeschaltet, weil das
 * Widget den gewünschten Zustand schon kennt.
 */
const setRecurringTodoCompleted = async (seriesId: string, day: string, completed: boolean) => {
  const { data: series, error: seriesError } = await supabase
    .from('planner_recurring_items')
    .select('id,user_id,entry_type')
    .eq('id', seriesId)
    .maybeSingle();
  if (seriesError) throw seriesError;
  if (!series || series.entry_type !== 'todo') return;

  const { error } = await supabase
    .from('planner_recurring_exceptions')
    .upsert(
      { user_id: series.user_id, recurring_item_id: seriesId, day, deleted: false, completed },
      { onConflict: 'recurring_item_id,day' },
    );
  if (error) throw error;
};

export type PlannerDrainResult = {
  /** Anzahl erfolgreich nach Supabase übertragener Abhakungen. */
  applied: number;
};

/**
 * Überträgt die im Widget abgehakten Aufgaben nach Supabase und schreibt
 * danach den frischen Tagesstand zurück ins Widget. Läuft beim Aktivieren
 * der App – auch ohne geöffneten Planer.
 */
export const drainPlannerWidgetToggles = async (
  options: { userId: string; locale?: PlannerLocale },
): Promise<PlannerDrainResult> => {
  if (!nativeModule) return { applied: 0 };

  const pending = await readPendingToggles();
  let applied = 0;

  for (const toggle of pending) {
    try {
      if (toggle.seriesId && toggle.occurrenceDate) {
        await setRecurringTodoCompleted(toggle.seriesId, toggle.occurrenceDate, toggle.completed);
      } else if (toggle.id.startsWith('recurring:')) {
        // Ältere Snapshots ohne Serienfelder: Serie und Tag stecken in der ID.
        const [, seriesId, day] = toggle.id.split(':');
        if (seriesId && day) await setRecurringTodoCompleted(seriesId, day, toggle.completed);
      } else {
        const { error } = await supabase
          .from('planner_items')
          .update({ completed: toggle.completed })
          .eq('id', toggle.id);
        if (error) throw error;
      }
      applied += 1;
    } catch (error) {
      console.warn('Failed to apply planner widget toggle:', error);
    }
  }

  // Auch ohne Änderungen: der Snapshot ist nach einem App-Start womöglich von
  // gestern, und nur die App kann ihn auf den heutigen Tag bringen.
  await refreshPlannerWidget({ userId: options.userId, locale: options.locale });
  return { applied };
};
