const DEFAULT_MIN_YEAR = 2000;
const SECONDS_THRESHOLD = 1_000_000_000_000;

type SafeDateOptions = {
  minYear?: number;
  minimumDate?: Date;
  maximumDate?: Date;
};

const normalizeTimestamp = (value: number): number => {
  if (!Number.isFinite(value)) return value;
  return Math.abs(value) < SECONDS_THRESHOLD ? value * 1000 : value;
};

const clampDate = (date: Date, options?: SafeDateOptions): Date => {
  if (!options) return date;

  if (options.minimumDate && date.getTime() < options.minimumDate.getTime()) {
    return new Date(options.minimumDate.getTime());
  }

  if (options.maximumDate && date.getTime() > options.maximumDate.getTime()) {
    return new Date(options.maximumDate.getTime());
  }

  return date;
};

export const parseSafeDate = (value: unknown, options?: SafeDateOptions): Date | null => {
  if (value === null || value === undefined) return null;

  let parsed: Date;

  if (value instanceof Date) {
    parsed = new Date(value.getTime());
  } else if (typeof value === 'number') {
    parsed = new Date(normalizeTimestamp(value));
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^-?\d+$/.test(trimmed)) {
      parsed = new Date(normalizeTimestamp(Number(trimmed)));
    } else {
      parsed = new Date(trimmed);
    }
  } else {
    return null;
  }

  if (!Number.isFinite(parsed.getTime())) return null;

  const minYear = options?.minYear ?? DEFAULT_MIN_YEAR;
  if (parsed.getFullYear() < minYear) return null;

  return clampDate(parsed, options);
};

export const getSafePickerDate = (value: unknown, fallback: Date, options?: SafeDateOptions): Date => {
  const safeFallback = parseSafeDate(fallback, options) ?? new Date();
  return parseSafeDate(value, options) ?? safeFallback;
};
