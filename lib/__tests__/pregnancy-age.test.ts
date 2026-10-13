import { getPregnancyAge, parsePregnancyDate } from '../pregnancy-age';

const today = new Date(2026, 9, 3, 16);
function dueFor(days: number) { const date = new Date(today); date.setDate(date.getDate() + 280 - days); return date; }
describe('calendar pregnancy dating', () => {
  it.each([[0, 1, 1], [97, 14, 1], [98, 15, 2], [195, 28, 2], [196, 29, 3], [280, 41, 3], [287, 42, 3], [294, 43, 3]])('dates day %i without confusing completed and running weeks', (days, runningWeek, trimester) => {
    const age = getPregnancyAge(dueFor(days), today)!;
    expect(age).toMatchObject({ totalDays: days, completedWeeks: Math.floor(days / 7), day: days % 7, runningWeek, trimester });
  });
  it('keeps the exact age after ET while bounding the editorial catalog', () => {
    expect(getPregnancyAge(dueFor(298), today)).toMatchObject({ completedWeeks: 42, day: 4, runningWeek: 43, dossierWeek: 42, daysToDueDate: -18 });
  });
  it('uses local calendar days across a clock change and day boundary', () => {
    const due = new Date(2026, 9, 26);
    expect(getPregnancyAge(due, new Date(2026, 9, 24, 23, 59))?.daysToDueDate).toBe(2);
    expect(getPregnancyAge(due, new Date(2026, 9, 25, 0, 1))?.daysToDueDate).toBe(1);
  });
  it('updates after ET changes and handles serialised cached dates', () => {
    const first = dueFor(183);
    const changed = new Date(first); changed.setDate(changed.getDate() + 2);
    expect(getPregnancyAge(first.toISOString(), today)).toMatchObject({ completedWeeks: 26, day: 1, runningWeek: 27 });
    expect(getPregnancyAge(changed, today)).toMatchObject({ completedWeeks: 25, day: 6, runningWeek: 26 });
  });
  it('reads date-only values locally and rejects invalid or impossible values', () => {
    expect(parsePregnancyDate('2026-10-03')?.getDate()).toBe(3);
    for (const value of [null, '', 'invalid', '2026-02-30', new Date(NaN)]) expect(getPregnancyAge(value, today)).toBeNull();
    expect(getPregnancyAge(dueFor(-1), today)).toBeNull();
  });
});
