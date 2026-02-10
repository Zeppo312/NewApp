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
        sent: false,
        sent_at: null,
        cancelled: false,
        cancelled_at: null,
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
