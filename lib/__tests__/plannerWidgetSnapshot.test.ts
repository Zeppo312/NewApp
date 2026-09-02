// Der Builder ist rein; die Supabase-/Auth-Abhängigkeiten des Moduls würden
// im Test nur RevenueCat & Co. nachladen.
jest.mock('../supabase', () => ({ supabase: {}, getLinkedUsers: jest.fn() }));
jest.mock('../baby', () => ({ listBabies: jest.fn() }));
jest.mock('@/services/planner', () => ({
  toDateOnlyISO: (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  expandRecurringForRange: jest.fn(),
  convertAssigneePerspective: jest.fn(),
}));

import { buildPlannerWidgetSnapshot } from '../plannerWidget';

const iso = (h: number, m = 0) => {
  const d = new Date(2026, 8, 1, h, m, 0, 0);
  return d.toISOString();
};

describe('buildPlannerWidgetSnapshot', () => {
  const now = new Date(2026, 8, 1, 12, 0, 0, 0);

  it('sorts events all-day first, then by start, and normalises colours', () => {
    const snapshot = buildPlannerWidgetSnapshot({
      now,
      locale: 'de',
      events: [
        { id: 'b', title: 'Später', start: iso(15), end: iso(16), color: '#3E7BC4' },
        { id: 'c', title: 'Ganztag', start: iso(0), end: iso(23, 59), isAllDay: true, color: '#D97A2F' },
        { id: 'a', title: 'Früh', start: iso(9), end: iso(10), color: 'kaputt' },
      ],
      todos: [],
    });

    expect(snapshot.events.map((e) => e.id)).toEqual(['c', 'a', 'b']);
    expect(snapshot.events[1].color).toBe('#5e3db3');
    expect(snapshot.dayKey).toBe('2026-09-01');
    expect(snapshot.localeTag).toBe('de-DE');
    expect(snapshot.strings.moreItems).toBe('+%d weitere');
  });

  it('orders todos open-timed, open-flexible, done and counts them', () => {
    const snapshot = buildPlannerWidgetSnapshot({
      now,
      locale: 'en',
      events: [],
      todos: [
        { id: 'done', title: 'Erledigt', completed: true },
        { id: 'flex', title: 'Flexibel', completed: false },
        { id: 'late', title: 'Spät', completed: false, dueAt: iso(18) },
        { id: 'early', title: 'Früh', completed: false, dueAt: iso(8), seriesId: 's1', occurrenceDate: '2026-09-01', isRecurring: true },
      ],
    });

    expect(snapshot.todos.map((t) => t.id)).toEqual(['early', 'late', 'flex', 'done']);
    expect(snapshot.openTodoCount).toBe(3);
    expect(snapshot.doneTodoCount).toBe(1);
    expect(snapshot.todos[0]).toMatchObject({ isRecurring: true, seriesId: 's1', occurrenceDate: '2026-09-01' });
    expect(snapshot.todos[2].dueAt).toBeNull();
  });
});
