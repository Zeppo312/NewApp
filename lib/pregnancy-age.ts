/** Calendar dates, rather than elapsed hours, keep SSW stable across DST. */
export function parsePregnancyDate(value: unknown): Date | null {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
  }
  const date = value instanceof Date ? new Date(value) : typeof value === 'string' ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

const calendarDay = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;

export type PregnancyAge = {
  totalDays: number;
  completedWeeks: number;
  day: number;
  runningWeek: number;
  dossierWeek: number;
  trimester: 1 | 2 | 3;
  daysToDueDate: number;
};

export function getPregnancyAge(dueDate: unknown, today = new Date()): PregnancyAge | null {
  const due = parsePregnancyDate(dueDate);
  if (!due || !Number.isFinite(today.getTime())) return null;
  const daysToDueDate = calendarDay(due) - calendarDay(today);
  // A future start date is not an existing pregnancy. Keep the ET editable.
  if (daysToDueDate > 280) return null;
  const totalDays = 280 - daysToDueDate;
  const completedWeeks = Math.floor(totalDays / 7);
  return {
    totalDays, completedWeeks, day: totalDays % 7,
    runningWeek: completedWeeks + 1,
    dossierWeek: Math.min(42, completedWeeks + 1),
    trimester: completedWeeks < 14 ? 1 : completedWeeks < 28 ? 2 : 3,
    daysToDueDate,
  };
}
