import { supabase } from '@/lib/supabase';

export type BabyReminderType = 'sleep_window' | 'feeding';

interface UpsertBabyReminderInput {
  userId: string;
  babyId: string;
  reminderType: BabyReminderType;
  scheduledFor: Date;
  title: string;
  body: string;
  scheduleKey: string;
  payload?: Record<string, unknown>;
}

interface CancelBabyReminderInput {
  userId: string;
  babyId: string;
  reminderType: BabyReminderType;
}

type ExistingReminderRecord = {
  id: string;
  schedule_key: string | null;
  sent: boolean;
  sent_at: string | null;
  cancelled: boolean;
  cancelled_at: string | null;
  payload?: Record<string, unknown> | null;
};

export async function upsertBabyReminderNotification({
  userId,
  babyId,
  reminderType,
  scheduledFor,
  title,
  body,
  scheduleKey,
  payload = {},
}: UpsertBabyReminderInput): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from('baby_reminder_notifications')
    .select('id, schedule_key, sent, sent_at, cancelled, cancelled_at, payload')
    .eq('user_id', userId)
    .eq('baby_id', babyId)
    .eq('reminder_type', reminderType)
    .maybeSingle<ExistingReminderRecord>();

  if (existingError) {
    throw existingError;
  }

  const existingExcludeToken =
    existing?.payload && typeof existing.payload.excludeToken === 'string'
      ? existing.payload.excludeToken
      : null;
  const nextExcludeToken =
    typeof payload.excludeToken === 'string'
      ? payload.excludeToken
      : null;
  const sameScheduleKey = existing?.schedule_key === scheduleKey;

  if (
    sameScheduleKey &&
    existing?.cancelled === false &&
    existingExcludeToken === nextExcludeToken
  ) {
    return;
  }

  const { error } = await supabase
    .from('baby_reminder_notifications')
    .upsert(
      {
        user_id: userId,
        baby_id: babyId,
        reminder_type: reminderType,
        scheduled_for: scheduledFor.toISOString(),
        title,
        body,
        schedule_key: scheduleKey,
        payload,
        sent: sameScheduleKey ? Boolean(existing?.sent) : false,
        sent_at: sameScheduleKey ? existing?.sent_at ?? null : null,
        cancelled: false,
        cancelled_at: sameScheduleKey ? existing?.cancelled_at ?? null : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,baby_id,reminder_type' }
    );

  if (error) {
    throw error;
  }
}

export async function cancelBabyReminderNotification({
  userId,
  babyId,
  reminderType,
}: CancelBabyReminderInput): Promise<void> {
  const { error } = await supabase
    .from('baby_reminder_notifications')
    .delete()
    .eq('user_id', userId)
    .eq('baby_id', babyId)
    .eq('reminder_type', reminderType);

  if (error) {
    throw error;
  }
}
