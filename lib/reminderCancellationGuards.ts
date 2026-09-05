const MANUAL_ENTRY_REMINDER_CANCEL_LOOKBACK_MS = 6 * 60 * 60 * 1000;
const MANUAL_ENTRY_REMINDER_CANCEL_FUTURE_TOLERANCE_MS = 2 * 60 * 1000;

type ManualEntryReminderCancelInput = {
  startTime: Date | string | null | undefined;
  endTime?: Date | string | null;
  now?: Date;
};

const toValidTimeMs = (value: Date | string | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

export function shouldCancelStaleReminderAfterManualEntry({
  startTime,
  endTime,
  now = new Date(),
}: ManualEntryReminderCancelInput): boolean {
  const startMs = toValidTimeMs(startTime);
  if (startMs === null) return false;

  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) return false;

  if (startMs > nowMs + MANUAL_ENTRY_REMINDER_CANCEL_FUTURE_TOLERANCE_MS) {
    return false;
  }

  const endMs = toValidTimeMs(endTime);
  const activityMs = endMs ?? startMs;

  return activityMs >= nowMs - MANUAL_ENTRY_REMINDER_CANCEL_LOOKBACK_MS;
}
