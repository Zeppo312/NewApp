import { useEffect, useMemo, useState } from 'react';

// Types
export type PlannerView = 'day' | 'week' | 'month';

export type PlannerAssignee = 'me' | 'partner';

export type PlannerTodo = {
  id: string;
  title: string;
  completed: boolean;
  dueAt?: string; // ISO
  blockId?: string; // Ref to Time-Block
  notes?: string;
  assignee?: PlannerAssignee;
};

export type PlannerEvent = {
  id: string;
  title: string;
  start: string; // ISO
  end: string; // ISO
  location?: string;
  blockId?: string;
};

export type PlannerBlock = {
  id: string;
  label: string; // "06:00 – 09:00"
  start: string; // ISO
  end: string; // ISO
  items: Array<PlannerTodo | PlannerEvent>;
};

export type Mood = 'great' | 'good' | 'okay' | 'bad';

export type PlannerDaySummary = {
  tasksDone: number;
  tasksTotal: number;
  eventsCount: number;
  babySleepHours?: number; // optional
  mood?: Mood;
  reflection?: string;
};

export type PlannerDay = {
  date: string; // YYYY-MM-DD
  blocks: PlannerBlock[];
  summary: PlannerDaySummary;
};

// Simple in-memory store
const store: Record<string, PlannerDay> = {};

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((cb) => cb());
}

// Helpers
function pad(n: number) {
  return n.toString().padStart(2, '0');
}

export function toDateOnlyISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoFor(d: Date, h: number, m: number) {
  const dt = new Date(d);
  dt.setHours(h, m, 0, 0);
  return dt.toISOString();
}

function labelFor(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return `${pad(s.getHours())}:${pad(s.getMinutes())} – ${pad(e.getHours())}:${pad(e.getMinutes())}`;
}

function makeBlocksFor(date: Date): PlannerBlock[] {
  const ranges = [
    [6, 0, 9, 0],
    [9, 0, 12, 0],
    [12, 0, 15, 0],
    [15, 0, 18, 0],
    [18, 0, 21, 0],
  ] as const;
  return ranges.map(([sh, sm, eh, em], i) => {
    const start = isoFor(date, sh, sm);
    const end = isoFor(date, eh, em);
    return {
      id: `b_${i}`,
      label: labelFor(start, end),
      start,
      end,
      items: [],
    } satisfies PlannerBlock;
  });
}

function ensureDay(date: Date): PlannerDay {
  const key = toDateOnlyISO(date);
  if (!store[key]) {
    const blocks = makeBlocksFor(date);
    // Seed mock data
    blocks[0].items.push(
      { id: 't1', title: 'Wäsche anschalten', completed: false, blockId: blocks[0].id, dueAt: isoFor(date, 7, 0), assignee: 'me' },
      { id: 'e1', title: 'Hebammen-Termin', start: isoFor(date, 8, 30), end: isoFor(date, 9, 0), location: 'Zuhause', blockId: blocks[0].id }
    );
    blocks[1].items.push(
      { id: 't2', title: 'Einkaufsliste schreiben', completed: true, blockId: blocks[1].id, dueAt: isoFor(date, 10, 30), assignee: 'partner' },
      { id: 't3', title: 'Paket abholen', completed: false, blockId: blocks[1].id, dueAt: isoFor(date, 12, 0), assignee: 'me' }
    );

    const summary: PlannerDaySummary = {
      tasksDone: blocks.flatMap(b => b.items).filter((x): x is PlannerTodo => 'completed' in x).filter(t => t.completed).length,
      tasksTotal: blocks.flatMap(b => b.items).filter((x): x is PlannerTodo => 'completed' in x).length,
      eventsCount: blocks.flatMap(b => b.items).filter((x): x is PlannerEvent => 'start' in x && 'end' in x).length,
      babySleepHours: 8,
    };
    store[key] = { date: key, blocks, summary };
  }
  return store[key];
}

function recalcSummary(day: PlannerDay) {
  const todos = day.blocks.flatMap((b) => b.items).filter((x): x is PlannerTodo => 'completed' in x);
  const events = day.blocks.flatMap((b) => b.items).filter((x): x is PlannerEvent => 'start' in x && 'end' in x);
  day.summary.tasksTotal = todos.length;
  day.summary.tasksDone = todos.filter((t) => t.completed).length;
  day.summary.eventsCount = events.length;
}

// CRUD-like actions
export function addTodo(
  date: Date,
  title: string,
  blockId?: string,
  dueAt?: string,
  notes?: string,
  assignee: PlannerAssignee = 'me'
) {
  const day = ensureDay(date);
  const id = `t_${Date.now()}`;
  const todo: PlannerTodo = { id, title, completed: false, dueAt, blockId, notes, assignee };
  const block = blockId ? day.blocks.find((b) => b.id === blockId) : day.blocks[0];
  (block ?? day.blocks[0]).items.push(todo);
  recalcSummary(day);
  notify();
  return { day, todo };
}

export function addEvent(date: Date, title: string, start: string, end: string, location?: string, blockId?: string) {
  const day = ensureDay(date);
  const id = `e_${Date.now()}`;
  const event: PlannerEvent = { id, title, start, end, location, blockId };
  const block = blockId ? day.blocks.find((b) => b.id === blockId) : day.blocks[0];
  (block ?? day.blocks[0]).items.push(event);
  recalcSummary(day);
  notify();
  return { day, event };
}

export function toggleTodo(date: Date, id: string) {
  const day = ensureDay(date);
  for (const b of day.blocks) {
    const it = b.items.find((x): x is PlannerTodo => 'completed' in x && x.id === id);
    if (it) {
      it.completed = !it.completed;
      recalcSummary(day);
      notify();
      return { day, todo: it };
    }
  }
}

export function moveToTomorrow(date: Date, id: string) {
  const day = ensureDay(date);
  let moved: PlannerTodo | PlannerEvent | undefined;
  outer: for (const b of day.blocks) {
    const idx = b.items.findIndex((x) => x.id === id);
    if (idx !== -1) {
      moved = b.items.splice(idx, 1)[0];
      break outer;
    }
  }
  if (!moved) return;
  recalcSummary(day);
  const tomorrow = new Date(date);
  tomorrow.setDate(date.getDate() + 1);
  const next = ensureDay(tomorrow);
  next.blocks[0].items.push({ ...moved, blockId: next.blocks[0].id } as any);
  recalcSummary(next);
  notify();
  return { today: day, tomorrow: next };
}

export function updateMood(date: Date, mood: Mood) {
  const day = ensureDay(date);
  day.summary.mood = mood;
  notify();
  return { day };
}

export function saveReflection(date: Date, text: string) {
  const day = ensureDay(date);
  day.summary.reflection = text;
  notify();
  return { day };
}

export function usePlannerDay(date: Date) {
  const iso = toDateOnlyISO(date);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const cb = () => setTick((t) => t + 1);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, [iso]);

  const state = useMemo(() => ensureDay(date), [iso, tick]);

  return {
    day: state,
    blocks: state.blocks,
    summary: state.summary,
    // bound actions
    addTodo: (title: string, blockId?: string, dueAt?: string, notes?: string, assignee?: PlannerAssignee) =>
      addTodo(date, title, blockId, dueAt, notes, assignee),
    addEvent: (title: string, start: string, end: string, location?: string, blockId?: string) =>
      addEvent(date, title, start, end, location, blockId),
    toggleTodo: (id: string) => toggleTodo(date, id),
    moveToTomorrow: (id: string) => moveToTomorrow(date, id),
    updateMood: (mood: Mood) => updateMood(date, mood),
    saveReflection: (text: string) => saveReflection(date, text),
  } as const;
}
