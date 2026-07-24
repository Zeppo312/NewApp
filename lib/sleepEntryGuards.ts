export type SleepEntryLike = {
  start_time?: string | Date | null;
  end_time?: string | Date | null;
};

export const MAX_ACTIVE_SLEEP_DURATION_MINUTES = 24 * 60;
export const MAX_ACTIVE_SLEEP_DURATION_MS = MAX_ACTIVE_SLEEP_DURATION_MINUTES * 60 * 1000;

const toTimeMs = (value: string | Date | null | undefined): number | null => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

export const getSleepEntryStartMs = (entry: SleepEntryLike): number | null =>
  toTimeMs(entry.start_time ?? null);

export const getAutoCloseEndTimeISO = (entry: SleepEntryLike): string | null => {
  const startMs = getSleepEntryStartMs(entry);
  if (startMs === null) return null;
  return new Date(startMs + MAX_ACTIVE_SLEEP_DURATION_MS).toISOString();
};

export const isStaleActiveSleepEntry = (
  entry: SleepEntryLike,
  nowMs: number = Date.now()
): boolean => {
  if (entry.end_time) return false;
  const startMs = getSleepEntryStartMs(entry);
  if (startMs === null) return true;
  return nowMs - startMs > MAX_ACTIVE_SLEEP_DURATION_MS;
};

export const findFreshActiveSleepEntry = <T extends SleepEntryLike>(
  entries: T[],
  nowMs: number = Date.now()
): T | null => entries.find((entry) => !entry.end_time && !isStaleActiveSleepEntry(entry, nowMs)) ?? null;
