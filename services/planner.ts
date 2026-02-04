import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getLinkedUsers, supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type PlannerView = 'day' | 'week' | 'month';

export type PlannerAssignee = 'me' | 'partner' | 'family' | 'child';

export type PlannerTodo = {
  id: string;
  title: string;
  completed: boolean;
  dueAt?: string;
  blockId?: string;
  notes?: string;
  assignee?: PlannerAssignee;
  babyId?: string;
  userId?: string;
  entryType?: 'todo' | 'note';
};

export type PlannerEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  assignee?: PlannerAssignee;
  babyId?: string;
  blockId?: string;
  userId?: string;
  isAllDay?: boolean;
};

export type PlannerBlock = {
  id: string;
  label: string;
  start: string;
  end: string;
  items: Array<PlannerTodo | PlannerEvent>;
};

export type Mood = 'great' | 'good' | 'okay' | 'bad';

export type PlannerDaySummary = {
  tasksDone: number;
  tasksTotal: number;
  eventsCount: number;
  babySleepHours?: number;
  mood?: Mood;
  reflection?: string;
};

export type PlannerDay = {
  date: string;
  blocks: PlannerBlock[];
  summary: PlannerDaySummary;
};

export type PlannerFloatingTodos = PlannerTodo[];

type PlannerDayRow = {
  id: string;
  user_id: string;
  day: string;
  baby_sleep_hours: number | null;
  mood: Mood | null;
  reflection: string | null;
};

type PlannerItemRow = {
  id: string;
  user_id: string;
  day_id: string;
  block_id: string | null;
  entry_type: 'todo' | 'event';
  title: string;
  completed: boolean;
  assignee: PlannerAssignee | null;
  baby_id: string | null;
  notes: string | null;
  location: string | null;
  due_at: string | null;
  start_at: string | null;
  end_at: string | null;
  is_all_day: boolean | null;
  created_at: string;
  updated_at: string;
};

type PlannerItemConversion = {
  title: string;
  notes?: string;
  dueAt?: string | null;
  assignee?: PlannerAssignee;
  start?: string;
  end?: string | null;
  location?: string;
};

type LoadedPlannerData = {
  blocks: PlannerBlock[];
  summary: PlannerDaySummary;
  baseDayId: string | null;
  itemsMap: Record<string, PlannerItemRow>;
  dayMap: Record<string, string>;
  floatingTodos: PlannerFloatingTodos;
  completedFloatingTodos: PlannerFloatingTodos;
};

type BlockDefinition = {
  key: string;
  label: string;
  startMinutes: number;
  endMinutes: number;
};

const BLOCK_DEFS: BlockDefinition[] = [
  { key: 'early', label: '06:00 – 09:00', startMinutes: 6 * 60, endMinutes: 9 * 60 },
  { key: 'late_morning', label: '09:00 – 12:00', startMinutes: 9 * 60, endMinutes: 12 * 60 },
  { key: 'afternoon', label: '12:00 – 15:00', startMinutes: 12 * 60, endMinutes: 15 * 60 },
  { key: 'late_afternoon', label: '15:00 – 18:00', startMinutes: 15 * 60, endMinutes: 18 * 60 },
  { key: 'evening', label: '18:00 – 21:00', startMinutes: 18 * 60, endMinutes: 21 * 60 },
];

const FLEX_LABEL = 'Flexibel';

const EMPTY_SUMMARY: PlannerDaySummary = {
  tasksDone: 0,
  tasksTotal: 0,
  eventsCount: 0,
};

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter((v): v is string => typeof v === 'string' && v.length > 0)));
}

function convertAssigneePerspective(
  assignee: PlannerAssignee | null | undefined,
  fromUserId: string,
  toUserId: string,
) {
  if (!assignee) return undefined;
  if (fromUserId === toUserId) return assignee;
  if (assignee === 'me') return 'partner';
  if (assignee === 'partner') return 'me';
  return assignee;
}

function minutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function isoForMinutes(date: Date, minutes: number) {
  const d = new Date(date);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d.toISOString();
}

function buildEmptyBlocks(date: Date): PlannerBlock[] {
  return BLOCK_DEFS.map((def, index) => ({
    id: `empty_${def.key}_${index}`,
    label: def.label,
    start: isoForMinutes(date, def.startMinutes),
    end: isoForMinutes(date, def.endMinutes),
    items: [],
  }));
}

function parseISO(value?: string | null): Date | null {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function extractErrorMessage(error: unknown) {
  if (!error) return 'Unbekannter Fehler';
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const err = error as any;
    if (typeof err.message === 'string') return err.message;
    if (typeof err.error === 'string') return err.error;
  }
  return 'Unbekannter Fehler';
}

async function ensurePlannerDayForUser(userId: string, date: Date): Promise<string> {
  const isoDate = toDateOnlyISO(date);

  const { data: existing, error: existingError } = await supabase
    .from('planner_days')
    .select('id')
    .eq('user_id', userId)
    .eq('day', isoDate)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    throw existingError;
  }
  if (existing?.id) {
    return existing.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('planner_days')
    .insert({ user_id: userId, day: isoDate })
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const retry = await supabase
        .from('planner_days')
        .select('id')
        .eq('user_id', userId)
        .eq('day', isoDate)
        .maybeSingle();
      if (retry.data?.id) return retry.data.id;
    }
    throw insertError;
  }

  const dayId = inserted.id;
  const blockRows = BLOCK_DEFS.map((def, index) => ({
    user_id: userId,
    day_id: dayId,
    label: def.label,
    start_time: isoForMinutes(date, def.startMinutes),
    end_time: isoForMinutes(date, def.endMinutes),
    position: index,
  }));

  const { error: blockError } = await supabase.from('planner_blocks').insert(blockRows);
  if (blockError && blockError.code !== '23505') {
    console.warn('Planner: Failed to initialise default blocks', blockError);
  }

  return dayId;
}

function buildAggregatedData(date: Date, dayRows: PlannerDayRow[], itemRows: PlannerItemRow[], baseUserId: string): LoadedPlannerData {
  const baseDayRow = dayRows.find((row) => row.user_id === baseUserId) ?? null;
  const workingDate = new Date(date);
  const selectedIso = toDateOnlyISO(workingDate);

  const blocks = buildEmptyBlocks(workingDate);
  const fallbackBlock: PlannerBlock = {
    id: 'flex',
    label: FLEX_LABEL,
    start: isoForMinutes(workingDate, 0),
    end: isoForMinutes(workingDate, 24 * 60 - 1),
    items: [],
  };

  const itemsMap: Record<string, PlannerItemRow> = {};
  const includedTodoRows: PlannerItemRow[] = [];
  const includedEventRows: PlannerItemRow[] = [];
  itemRows.forEach((row) => {
    itemsMap[row.id] = row;

    if (row.entry_type === 'event') {
      const startDate = parseISO(row.start_at) ?? parseISO(row.due_at) ?? new Date(workingDate);
      const endDate = parseISO(row.end_at) ?? new Date(startDate.getTime() + 30 * 60000);

      // Check if the selected date falls within the event's date range
      const startIso = toDateOnlyISO(startDate);
      const endIso = toDateOnlyISO(endDate);
      const isOnStartDay = startIso === selectedIso;
      const isMultiDayOverlap = startIso < selectedIso && endIso >= selectedIso;

      if (!isOnStartDay && !isMultiDayOverlap) {
        return;
      }

      includedEventRows.push(row);

      // For multi-day events shown on days other than the start day, treat as all-day
      const isEffectivelyAllDay = row.is_all_day || isMultiDayOverlap;

      const event: PlannerEvent = {
        id: row.id,
        title: row.title,
        start: (startDate ?? workingDate).toISOString(),
        end: endDate.toISOString(),
        location: row.location ?? undefined,
        assignee: convertAssigneePerspective(row.assignee, row.user_id, baseUserId),
        babyId: row.baby_id ?? undefined,
        blockId: row.block_id ?? undefined,
        userId: row.user_id,
        isAllDay: isEffectivelyAllDay,
      };
      const minute = startDate ? minutesSinceMidnight(startDate) : null;
      const targetIndex =
        minute === null || isEffectivelyAllDay
          ? -1
          : BLOCK_DEFS.findIndex((def) => minute >= def.startMinutes && minute < def.endMinutes);
      if (targetIndex === -1) fallbackBlock.items.push(event);
      else blocks[targetIndex].items.push(event);
      return;
    }

    const dueDate = parseISO(row.due_at);
    if (dueDate && toDateOnlyISO(dueDate) !== selectedIso) {
      return;
    }
    includedTodoRows.push(row);
    const todo: PlannerTodo = {
      id: row.id,
      title: row.title,
      completed: row.entry_type === 'todo' ? !!row.completed : false,
      dueAt: row.due_at ?? undefined,
      blockId: row.block_id ?? undefined,
      notes: row.notes ?? undefined,
      assignee: convertAssigneePerspective(row.assignee, row.user_id, baseUserId),
      babyId: row.baby_id ?? undefined,
      userId: row.user_id,
      entryType: row.entry_type,
    };
    const minute = dueDate ? minutesSinceMidnight(dueDate) : null;
    const targetIndex =
      minute === null
        ? -1
        : BLOCK_DEFS.findIndex((def) => minute >= def.startMinutes && minute < def.endMinutes);
    if (targetIndex === -1) fallbackBlock.items.push(todo);
    else blocks[targetIndex].items.push(todo);
  });

  if (fallbackBlock.items.length > 0) {
    blocks.push(fallbackBlock);
  }

  blocks.forEach((block) => {
    block.items.sort((a, b) => {
      const aDate = 'completed' in a ? parseISO(a.dueAt) : parseISO(a.start);
      const bDate = 'completed' in b ? parseISO(b.dueAt) : parseISO(b.start);
      const aTime = aDate ? aDate.getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = bDate ? bDate.getTime() : Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      return a.title.localeCompare(b.title);
    });
  });

  const todoRows = includedTodoRows;
  const eventsCount = includedEventRows.length;

  const summary: PlannerDaySummary = {
    tasksDone: todoRows.filter((row) => row.completed).length,
    tasksTotal: todoRows.length,
    eventsCount,
    babySleepHours: baseDayRow?.baby_sleep_hours ?? undefined,
    mood: baseDayRow?.mood ?? undefined,
    reflection: baseDayRow?.reflection ?? undefined,
  };

  const dayMap: Record<string, string> = {};
  dayRows.forEach((row) => {
    dayMap[row.id] = row.day;
  });

  return {
    blocks,
    summary,
    baseDayId: baseDayRow?.id ?? null,
    itemsMap,
    dayMap,
    floatingTodos: [],
    completedFloatingTodos: [],
  };
}

export function toDateOnlyISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function usePlannerDay(date: Date) {
  const { user } = useAuth();
  const dateKey = date.getTime();
  const normalizedDate = useMemo(() => {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
  }, [dateKey]);
  const normalizedKey = normalizedDate.getTime();
  const dateIso = useMemo(() => toDateOnlyISO(normalizedDate), [normalizedKey]);

  const [blocks, setBlocks] = useState<PlannerBlock[]>(() => buildEmptyBlocks(normalizedDate));
  const [summary, setSummary] = useState<PlannerDaySummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [baseDayId, setBaseDayId] = useState<string | null>(null);
  const [itemsMap, setItemsMap] = useState<Record<string, PlannerItemRow>>({});
  const [dayDateById, setDayDateById] = useState<Record<string, string>>({});
  const [linkedUserIds, setLinkedUserIds] = useState<string[]>([]);
  const [floatingTodos, setFloatingTodos] = useState<PlannerFloatingTodos>([]);
  const [completedFloatingTodos, setCompletedFloatingTodos] = useState<PlannerFloatingTodos>([]);

  useEffect(() => {
    setBlocks(buildEmptyBlocks(normalizedDate));
    setSummary(EMPTY_SUMMARY);
    setItemsMap({});
    setBaseDayId(null);
    setDayDateById({});
    setFloatingTodos([]);
    setCompletedFloatingTodos([]);
  }, [normalizedKey, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setLinkedUserIds([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const result = await getLinkedUsers(user.id);
        if (!active) return;
        if (result?.success && Array.isArray(result.linkedUsers)) {
          const ids = result.linkedUsers
            .map((entry: any) => entry?.userId)
            .filter((value: any): value is string => typeof value === 'string');
          setLinkedUserIds(uniqueStrings(ids));
        } else {
          setLinkedUserIds([]);
        }
      } catch (err) {
        console.error('Planner: failed to load linked users', err);
        if (active) setLinkedUserIds([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const linkedKey = useMemo(() => uniqueStrings(linkedUserIds).sort().join(','), [linkedUserIds]);

  const loadPlannerData = useCallback(async (): Promise<LoadedPlannerData> => {
    if (!user?.id) {
      return {
        blocks: buildEmptyBlocks(normalizedDate),
        summary: EMPTY_SUMMARY,
        baseDayId: null,
        itemsMap: {},
        dayMap: {},
        floatingTodos: [],
        completedFloatingTodos: [],
      };
    }

    const allUserIds = uniqueStrings([user.id, ...linkedUserIds]);
    const ownerIds = allUserIds.length > 0 ? allUserIds : [user.id];

    const ensuredDayId = await ensurePlannerDayForUser(user.id, normalizedDate);

    const { data: dayRows, error: dayError } = await supabase
      .from('planner_days')
      .select('id,user_id,day,baby_sleep_hours,mood,reflection')
      .eq('day', dateIso)
      .in('user_id', ownerIds);

    if (dayError) throw dayError;

    const dayIds = (dayRows ?? []).map((row) => row.id);

    const { data: itemRows, error: itemsError } = dayIds.length
      ? await supabase
          .from('planner_items')
          .select(
            'id,user_id,day_id,block_id,entry_type,title,completed,assignee,baby_id,notes,location,due_at,start_at,end_at,is_all_day,created_at,updated_at',
          )
          .in('day_id', dayIds)
      : { data: [], error: null };

    if (itemsError) throw itemsError;

    // Query for multi-day events that overlap with the selected date
    // These are events that started before this day but end on or after this day
    const selectedDayStart = new Date(normalizedDate);
    selectedDayStart.setHours(0, 0, 0, 0);
    const selectedDayEnd = new Date(normalizedDate);
    selectedDayEnd.setHours(23, 59, 59, 999);

    const { data: multiDayEventRows, error: multiDayError } = await supabase
      .from('planner_items')
      .select(
        'id,user_id,day_id,block_id,entry_type,title,completed,assignee,baby_id,notes,location,due_at,start_at,end_at,is_all_day,created_at,updated_at',
      )
      .in('user_id', ownerIds)
      .eq('entry_type', 'event')
      .lt('start_at', selectedDayStart.toISOString()) // Started before this day
      .gte('end_at', selectedDayStart.toISOString()); // Ends on or after this day

    if (multiDayError) throw multiDayError;

    // Merge multi-day events with regular items, avoiding duplicates
    const allItemRows = [...(itemRows ?? [])];
    const existingIds = new Set(allItemRows.map(row => row.id));
    (multiDayEventRows ?? []).forEach(row => {
      if (!existingIds.has(row.id)) {
        allItemRows.push(row);
        existingIds.add(row.id);
      }
    });

    const { data: floatingOpenRows, error: floatingOpenError } = await supabase
      .from('planner_items')
      .select(
        'id,user_id,day_id,block_id,entry_type,title,completed,assignee,baby_id,notes,location,due_at,start_at,end_at,is_all_day,created_at,updated_at',
      )
      .in('user_id', ownerIds)
      .is('due_at', null)
      .eq('entry_type', 'todo')
      .eq('completed', false)
      .order('created_at', { ascending: true });

    if (floatingOpenError) throw floatingOpenError;

    const completedStart = new Date(normalizedDate);
    completedStart.setHours(0, 0, 0, 0);
    const completedEnd = new Date(completedStart);
    completedEnd.setDate(completedEnd.getDate() + 1);

    const { data: floatingDoneRows, error: floatingDoneError } = await supabase
      .from('planner_items')
      .select(
        'id,user_id,day_id,block_id,entry_type,title,completed,assignee,baby_id,notes,location,due_at,start_at,end_at,is_all_day,created_at,updated_at',
      )
      .in('user_id', ownerIds)
      .is('due_at', null)
      .eq('entry_type', 'todo')
      .eq('completed', true)
      .gte('updated_at', completedStart.toISOString())
      .lt('updated_at', completedEnd.toISOString())
      .order('updated_at', { ascending: false })
      .limit(50);

    if (floatingDoneError) throw floatingDoneError;

    const aggregated = buildAggregatedData(normalizedDate, dayRows ?? [], allItemRows, user.id);
    const floatingItemsMap: Record<string, PlannerItemRow> = {};
    [...(floatingOpenRows ?? []), ...(floatingDoneRows ?? [])].forEach((row) => {
      if (!row?.id) return;
      floatingItemsMap[row.id] = row as PlannerItemRow;
    });
    const mergedItemsMap = { ...aggregated.itemsMap, ...floatingItemsMap };
    return {
      ...aggregated,
      itemsMap: mergedItemsMap,
      floatingTodos: (floatingOpenRows ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        completed: row.completed,
        dueAt: row.due_at ?? undefined,
        blockId: row.block_id ?? undefined,
        notes: row.notes ?? undefined,
        assignee: convertAssigneePerspective(row.assignee, row.user_id, user.id),
        babyId: row.baby_id ?? undefined,
        userId: row.user_id,
        entryType: row.entry_type,
      })),
      completedFloatingTodos: (floatingDoneRows ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        completed: row.completed,
        dueAt: row.due_at ?? undefined,
        blockId: row.block_id ?? undefined,
        notes: row.notes ?? undefined,
        assignee: convertAssigneePerspective(row.assignee, row.user_id, user.id),
        babyId: row.baby_id ?? undefined,
        userId: row.user_id,
        entryType: row.entry_type,
      })),
      baseDayId: aggregated.baseDayId ?? ensuredDayId,
    };
  }, [user?.id, linkedKey, normalizedKey, dateIso, normalizedDate]);

  const itemsMapRef = useRef<Record<string, PlannerItemRow>>({});
  const baseDayIdRef = useRef<string | null>(null);
  const dayDateByIdRef = useRef<Record<string, string>>({});

  const applyLoadedData = useCallback((data: LoadedPlannerData) => {
    itemsMapRef.current = data.itemsMap;
    baseDayIdRef.current = data.baseDayId;
    dayDateByIdRef.current = data.dayMap;
    setBlocks(data.blocks);
    setSummary(data.summary);
    setBaseDayId(data.baseDayId);
    setItemsMap(data.itemsMap);
    setDayDateById(data.dayMap);
    setFloatingTodos(data.floatingTodos ?? []);
    setCompletedFloatingTodos(data.completedFloatingTodos ?? []);
  }, []);

  useEffect(() => {
    let canceled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await loadPlannerData();
        if (!canceled) {
          applyLoadedData(data);
        }
      } catch (err) {
        if (!canceled) {
          setError(extractErrorMessage(err));
          console.error('Planner: failed to load data', err);
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [loadPlannerData, applyLoadedData]);

  const reloadSilently = useCallback(async () => {
    try {
      const data = await loadPlannerData();
      applyLoadedData(data);
    } catch (err) {
      setError(extractErrorMessage(err));
      console.error('Planner: failed to refresh data', err);
    }
  }, [loadPlannerData, applyLoadedData]);

  useEffect(() => {
    itemsMapRef.current = itemsMap;
  }, [itemsMap]);

  useEffect(() => {
    baseDayIdRef.current = baseDayId;
  }, [baseDayId]);

  useEffect(() => {
    dayDateByIdRef.current = dayDateById;
  }, [dayDateById]);

  const recordDayMapping = useCallback(
    (dayId: string, date: Date) => {
      const iso = toDateOnlyISO(date);
      dayDateByIdRef.current = { ...dayDateByIdRef.current, [dayId]: iso };
      setDayDateById((prev) => {
        if (prev[dayId] === iso) return prev;
        return { ...prev, [dayId]: iso };
      });
    },
    [],
  );

  const ensureDayFor = useCallback(
    async (ownerId: string, date: Date) => {
      const ensuredId = await ensurePlannerDayForUser(ownerId, date);
      recordDayMapping(ensuredId, date);
      if (ownerId === user?.id && toDateOnlyISO(date) === dateIso) {
        baseDayIdRef.current = ensuredId;
        setBaseDayId((prev) => (prev === ensuredId ? prev : ensuredId));
      }
      return ensuredId;
    },
    [recordDayMapping, user?.id, dateIso],
  );

  const addTodo = useCallback(
    async (
      title: string,
      blockId?: string,
      dueAt?: string | null,
      notes?: string,
      assignee: PlannerAssignee = 'me',
      babyId?: string,
      ownerIdOverride?: string,
    ) => {
      if (!user?.id) return;
      const viewerId = user.id;
      const ownerId = ownerIdOverride ?? viewerId;
      let targetDayId = ownerId === viewerId ? baseDayIdRef.current : null;
      let targetBlockId = blockId ?? null;

      if (!targetDayId) {
        targetDayId = await ensureDayFor(ownerId, normalizedDate);
      }

      if (dueAt) {
        const dueDate = parseISO(dueAt);
        if (dueDate) {
          const dueIso = toDateOnlyISO(dueDate);
          if (dueIso !== dateIso) {
            targetDayId = await ensureDayFor(ownerId, dueDate);
            targetBlockId = null;
          }
        }
      }

      if (!targetDayId) {
        targetDayId = await ensureDayFor(ownerId, normalizedDate);
      }

      const payload = {
        user_id: ownerId,
        day_id: targetDayId,
        block_id: targetBlockId,
        entry_type: 'todo' as const,
        title,
        completed: false,
        assignee: convertAssigneePerspective(assignee, viewerId, ownerId),
        baby_id: babyId ?? null,
        notes: notes ?? null,
        due_at: dueAt ?? null,
      };
      const { error: insertError } = await supabase.from('planner_items').insert(payload);
      if (insertError) {
        setError(extractErrorMessage(insertError));
        console.error('Planner: addTodo failed', insertError);
        return;
      }
      await reloadSilently();
    },
    [reloadSilently, user?.id, ensureDayFor, normalizedDate, dateIso],
  );

  const addEvent = useCallback(
    async (
      title: string,
      start: string,
      end: string,
      location?: string,
      assignee: PlannerAssignee = 'me',
      babyId?: string,
      blockId?: string,
      ownerIdOverride?: string,
      isAllDay?: boolean,
    ) => {
      if (!user?.id) return;
      const viewerId = user.id;
      const ownerId = ownerIdOverride ?? viewerId;
      let targetDayId = ownerId === viewerId ? baseDayIdRef.current : null;
      let targetBlockId = blockId ?? null;

      if (!targetDayId) {
        targetDayId = await ensureDayFor(ownerId, normalizedDate);
      }

      const startDate = parseISO(start);
      if (startDate) {
        const startIso = toDateOnlyISO(startDate);
        if (startIso !== dateIso) {
          targetDayId = await ensureDayFor(ownerId, startDate);
          targetBlockId = null;
        }
      }

      if (!targetDayId) {
        targetDayId = await ensureDayFor(ownerId, normalizedDate);
      }

      const payload = {
        user_id: ownerId,
        day_id: targetDayId,
        block_id: targetBlockId,
        entry_type: 'event' as const,
        title,
        start_at: start,
        end_at: end,
        location: location ?? null,
        assignee: convertAssigneePerspective(assignee, viewerId, ownerId),
        baby_id: babyId ?? null,
        is_all_day: isAllDay ?? false,
      };
      const { error: insertError } = await supabase.from('planner_items').insert(payload);
      if (insertError) {
        setError(extractErrorMessage(insertError));
        console.error('Planner: addEvent failed', insertError);
        return;
      }
      await reloadSilently();
    },
    [reloadSilently, user?.id, ensureDayFor, normalizedDate, dateIso],
  );

  const updateTodo = useCallback(
    async (id: string, updates: { title?: string; notes?: string; dueAt?: string | null; assignee?: PlannerAssignee; babyId?: string | null }) => {
      const row = itemsMapRef.current[id];
      if (!row || row.entry_type !== 'todo') return;
      if (!user?.id) return;
      const viewerId = user.id;
      const payload: Record<string, any> = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.notes !== undefined) payload.notes = updates.notes ?? null;
      if (updates.assignee !== undefined) {
        payload.assignee = convertAssigneePerspective(updates.assignee, viewerId, row.user_id);
      }
      if (updates.babyId !== undefined) {
        payload.baby_id = updates.babyId ?? null;
      }

      let newDayId: string | undefined;
      if (updates.dueAt !== undefined) {
        payload.due_at = updates.dueAt ?? null;
        if (updates.dueAt) {
          const ownerId = row.user_id ?? user?.id;
          const dueDate = parseISO(updates.dueAt);
          if (ownerId && dueDate) {
            const nextIso = toDateOnlyISO(dueDate);
            const currentIso =
              (row.day_id && dayDateByIdRef.current[row.day_id]) ||
              (row.due_at ? toDateOnlyISO(new Date(row.due_at)) : undefined);
            if (!currentIso || currentIso !== nextIso) {
              const ensured = await ensureDayFor(ownerId, dueDate);
              if (ensured !== row.day_id) {
                newDayId = ensured;
                payload.block_id = null;
              }
            }
          }
        }
      }

      if (newDayId) {
        payload.day_id = newDayId;
      }

      if (Object.keys(payload).length === 0) return;
      const { error: updateError } = await supabase.from('planner_items').update(payload).eq('id', id);
      if (updateError) {
        setError(extractErrorMessage(updateError));
        console.error('Planner: updateTodo failed', updateError);
        return;
      }
      await reloadSilently();
    },
    [reloadSilently, ensureDayFor, user?.id],
  );

  const updateEvent = useCallback(
    async (id: string, updates: { title?: string; start?: string; end?: string; location?: string; assignee?: PlannerAssignee; babyId?: string | null; isAllDay?: boolean }) => {
      const row = itemsMapRef.current[id];
      if (!row || row.entry_type !== 'event') return;
      if (!user?.id) return;
      const viewerId = user.id;
      const payload: Record<string, any> = {};
      if (updates.title !== undefined) payload.title = updates.title;
      if (updates.start !== undefined) payload.start_at = updates.start;
      if (updates.end !== undefined) payload.end_at = updates.end ?? null;
      if (updates.location !== undefined) payload.location = updates.location ?? null;
      if (updates.assignee !== undefined) {
        payload.assignee = convertAssigneePerspective(updates.assignee, viewerId, row.user_id);
      }
      if (updates.babyId !== undefined) {
        payload.baby_id = updates.babyId ?? null;
      }
      if (updates.isAllDay !== undefined) {
        payload.is_all_day = updates.isAllDay;
      }

      let newDayId: string | undefined;
      if (updates.start !== undefined && updates.start) {
        const ownerId = row.user_id ?? user?.id;
        const nextStartDate = parseISO(updates.start);
        if (ownerId && nextStartDate) {
          const nextIso = toDateOnlyISO(nextStartDate);
          const currentIso =
            (row.day_id && dayDateByIdRef.current[row.day_id]) ||
            (row.start_at ? toDateOnlyISO(new Date(row.start_at)) : undefined);
          if (!currentIso || currentIso !== nextIso) {
            const ensured = await ensureDayFor(ownerId, nextStartDate);
            if (ensured !== row.day_id) {
              newDayId = ensured;
              payload.block_id = null;
            }
          }
        }
      }

      if (newDayId) {
        payload.day_id = newDayId;
      }

      if (Object.keys(payload).length === 0) return;
      const { error: updateError } = await supabase.from('planner_items').update(payload).eq('id', id);
      if (updateError) {
        setError(extractErrorMessage(updateError));
        console.error('Planner: updateEvent failed', updateError);
        return;
      }
      await reloadSilently();
    },
    [reloadSilently, ensureDayFor, user?.id],
  );

  const convertPlannerItem = useCallback(
    async (id: string, nextType: 'todo' | 'event', updates: PlannerItemConversion) => {
      const row = itemsMapRef.current[id];
      if (!row || !user?.id) return;
      const viewerId = user.id;
      const ownerId = row.user_id ?? viewerId;

      const payload: Record<string, any> = {
        entry_type: nextType,
        title: updates.title,
      };

      if (updates.notes !== undefined) {
        payload.notes = updates.notes ?? null;
      }

      let newDayId: string | undefined;
      const currentIso =
        (row.day_id && dayDateByIdRef.current[row.day_id]) ||
        (row.start_at ? toDateOnlyISO(new Date(row.start_at)) : undefined) ||
        (row.due_at ? toDateOnlyISO(new Date(row.due_at)) : undefined);

      if (nextType === 'event') {
        if (!updates.start) return;
        payload.start_at = updates.start;
        payload.end_at = updates.end ?? null;
        payload.location = updates.location ?? null;
        payload.due_at = null;
        payload.completed = false;
        const nextAssignee = updates.assignee ?? 'me';
        payload.assignee = convertAssigneePerspective(nextAssignee, viewerId, ownerId);

        const startDate = parseISO(updates.start);
        if (startDate) {
          const nextIso = toDateOnlyISO(startDate);
          if (!currentIso || currentIso !== nextIso) {
            const ensured = await ensureDayFor(ownerId, startDate);
            if (ensured !== row.day_id) {
              newDayId = ensured;
              payload.block_id = null;
            }
          }
        }
      } else {
        payload.due_at = updates.dueAt ?? null;
        payload.start_at = null;
        payload.end_at = null;
        payload.location = null;
        payload.completed = false;
        payload.is_all_day = false;

        const nextAssignee = updates.assignee ?? 'me';
        payload.assignee = convertAssigneePerspective(nextAssignee, viewerId, ownerId);

        if (updates.dueAt) {
          const dueDate = parseISO(updates.dueAt);
          if (dueDate) {
            const nextIso = toDateOnlyISO(dueDate);
            if (!currentIso || currentIso !== nextIso) {
              const ensured = await ensureDayFor(ownerId, dueDate);
              if (ensured !== row.day_id) {
                newDayId = ensured;
                payload.block_id = null;
              }
            }
          }
        }
      }

      if (newDayId) {
        payload.day_id = newDayId;
      }

      const { error: updateError } = await supabase.from('planner_items').update(payload).eq('id', id);
      if (updateError) {
        setError(extractErrorMessage(updateError));
        console.error('Planner: convertPlannerItem failed', updateError);
        return;
      }
      await reloadSilently();
    },
    [reloadSilently, ensureDayFor, user?.id],
  );

  const toggleTodo = useCallback(
    async (id: string) => {
      const row = itemsMapRef.current[id];
      if (!row || row.entry_type !== 'todo') return;
      const { error: updateError } = await supabase
        .from('planner_items')
        .update({ completed: !row.completed })
        .eq('id', id);
      if (updateError) {
        setError(extractErrorMessage(updateError));
        console.error('Planner: toggleTodo failed', updateError);
        return;
      }
      await reloadSilently();
    },
    [reloadSilently],
  );

  const moveToTomorrow = useCallback(
    async (id: string) => {
      const row = itemsMapRef.current[id];
      if (!row || row.entry_type !== 'todo') return;
      const ownerId = row.user_id ?? user?.id;
      if (!ownerId) return;
      const tomorrow = new Date(normalizedDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      let targetDayId: string;
      try {
        targetDayId = await ensureDayFor(ownerId, tomorrow);
      } catch (err) {
        setError(extractErrorMessage(err));
        console.error('Planner: ensurePlannerDayForUser failed', err);
        return;
      }
      let nextDueAt = row.due_at;
      if (row.due_at) {
        const due = new Date(row.due_at);
        due.setDate(due.getDate() + 1);
        nextDueAt = due.toISOString();
      } else if (row.entry_type === 'todo') {
        nextDueAt = isoForMinutes(tomorrow, 12 * 60);
      }
      const { error: updateError } = await supabase
        .from('planner_items')
        .update({ day_id: targetDayId, block_id: null, due_at: nextDueAt })
        .eq('id', id);
      if (updateError) {
        setError(extractErrorMessage(updateError));
        console.error('Planner: moveToTomorrow failed', updateError);
        return;
      }
      await reloadSilently();
    },
    [reloadSilently, normalizedKey, ensureDayFor, user?.id],
  );

  const updateMood = useCallback(
    async (mood: Mood) => {
      const dayId = baseDayIdRef.current;
      if (!dayId) return;
      const { error: updateError } = await supabase.from('planner_days').update({ mood }).eq('id', dayId);
      if (updateError) {
        setError(extractErrorMessage(updateError));
        console.error('Planner: updateMood failed', updateError);
        return;
      }
      await reloadSilently();
    },
    [reloadSilently],
  );

  const saveReflection = useCallback(
    async (text: string) => {
      const dayId = baseDayIdRef.current;
      if (!dayId) return;
      const { error: updateError } = await supabase.from('planner_days').update({ reflection: text }).eq('id', dayId);
      if (updateError) {
        setError(extractErrorMessage(updateError));
        console.error('Planner: saveReflection failed', updateError);
        return;
      }
      await reloadSilently();
    },
    [reloadSilently],
  );

  const day = useMemo<PlannerDay>(
    () => ({
      date: dateIso,
      blocks,
      summary,
    }),
    [dateIso, blocks, summary],
  );

  return {
    day,
    blocks,
    summary,
    floatingTodos,
    completedFloatingTodos,
    loading,
    error,
    addTodo,
    addEvent,
    updateTodo,
    updateEvent,
    convertPlannerItem,
    toggleTodo,
    moveToTomorrow,
    updateMood,
    saveReflection,
    refetch: reloadSilently,
  } as const;
}
