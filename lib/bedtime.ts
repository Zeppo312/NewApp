export const DEFAULT_BEDTIME_ANCHOR = '19:30';

const BEDTIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const BEDTIME_WITH_SECONDS_PATTERN = /^([01]\d|2[0-3]):([0-5]\d):[0-5]\d(?:\.\d+)?$/;
const ISO_TIME_PATTERN = /T([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?/;
const GENERIC_TIME_PATTERN = /\b([01]\d|2[0-3]):([0-5]\d)\b/;

const formatBedtime = (hours: number, minutes: number): string =>
  `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

const extractBedtimeFromString = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const exactMatch = trimmed.match(BEDTIME_PATTERN);
  if (exactMatch) {
    return formatBedtime(Number(exactMatch[1]), Number(exactMatch[2]));
  }

  const withSecondsMatch = trimmed.match(BEDTIME_WITH_SECONDS_PATTERN);
  if (withSecondsMatch) {
    return formatBedtime(Number(withSecondsMatch[1]), Number(withSecondsMatch[2]));
  }

  const isoTimeMatch = trimmed.match(ISO_TIME_PATTERN);
  if (isoTimeMatch) {
    return formatBedtime(Number(isoTimeMatch[1]), Number(isoTimeMatch[2]));
  }

  const genericTimeMatch = trimmed.match(GENERIC_TIME_PATTERN);
  if (genericTimeMatch) {
    return formatBedtime(Number(genericTimeMatch[1]), Number(genericTimeMatch[2]));
  }

  const asDate = new Date(trimmed);
  if (Number.isFinite(asDate.getTime())) {
    return formatBedtime(asDate.getHours(), asDate.getMinutes());
  }

  return null;
};

export function isValidBedtimeAnchor(value?: string | null): value is string {
  return typeof value === 'string' && BEDTIME_PATTERN.test(value);
}

export function normalizeBedtimeAnchor(value?: string | null): string {
  if (isValidBedtimeAnchor(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = extractBedtimeFromString(value);
    if (normalized) return normalized;
  }
  return DEFAULT_BEDTIME_ANCHOR;
}

export function bedtimeAnchorToDate(value?: string | null, referenceDate?: Date): Date {
  const normalized = normalizeBedtimeAnchor(value);
  const [hours, minutes] = normalized.split(':').map((part) => Number(part));
  const date = referenceDate && Number.isFinite(referenceDate.getTime())
    ? new Date(referenceDate.getTime())
    : new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function dateToBedtimeAnchor(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}
