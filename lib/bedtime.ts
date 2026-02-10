export const DEFAULT_BEDTIME_ANCHOR = '19:30';

const BEDTIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidBedtimeAnchor(value?: string | null): value is string {
  return typeof value === 'string' && BEDTIME_PATTERN.test(value);
}

export function normalizeBedtimeAnchor(value?: string | null): string {
  if (isValidBedtimeAnchor(value)) {
    return value;
  }
  return DEFAULT_BEDTIME_ANCHOR;
}

export function bedtimeAnchorToDate(value?: string | null): Date {
  const normalized = normalizeBedtimeAnchor(value);
  const [hours, minutes] = normalized.split(':').map((part) => Number(part));
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function dateToBedtimeAnchor(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
