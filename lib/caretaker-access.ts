import type { CustomActivityType } from '@/lib/customActivities';
import { supabase } from '@/lib/supabase';

export type CaretakerGrant = {
  id: string; baby_id: string; baby_name: string | null; owner_id: string;
  accepted_at: string | null; caregiver_id: string | null; label: string; invitation_code: string | null;
  starts_at: string; ends_at: string; history_days: number;
  allow_entries: boolean; revoked_at: string | null;
};
export type CaretakerActivity = Pick<CustomActivityType, 'id' | 'name' | 'emoji' | 'color' | 'tracking_mode' | 'unit' | 'default_quantity'>;
export type CaretakerEntry = {
  custom_activity_type_id?: string | null; custom_color?: string | null;
  custom_tracking_mode?: CustomActivityType['tracking_mode'] | null;
  can_edit?: boolean; quality?: 'good' | 'medium' | 'bad' | null;
  id: string; start_time: string; end_time: string | null; notes: string | null;
  entry_type?: string; feeding_type?: string; feeding_volume_ml?: number | null;
  diaper_type?: string; custom_name?: string | null; custom_emoji?: string | null;
  custom_quantity?: string | null; custom_unit?: string | null;
};
export type CaretakerSnapshot = {
  server_now: string; starts_at: string; ends_at: string; visible_from: string;
  allow_entries: boolean; baby_name: string | null;
  custom_activities?: CaretakerActivity[];
  sleep: CaretakerEntry[]; daily: CaretakerEntry[];
};
export type CaretakerCommand = 'custom' | 'custom_update' | 'sleep_start' | 'sleep_stop' | 'sleep_add' | 'sleep_update' | 'sleep_delete' | 'daily_update' | 'daily_delete' | 'bottle' | 'solids' | 'diaper_wet' | 'diaper_dirty' | 'diaper_both';
export async function caretakerRequest<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const { data, error } = await supabase.rpc('caretaker_access', { p_action: action, p_payload: payload }).abortSignal(controller.signal);
    if (error) throw error;
    return data as T;
  } finally { clearTimeout(timeout); }
}
export function normalizeCaretakerCode(input: string): string | null {
  const code = input.trim().replace(/[\s-]/g, '').toLowerCase();
  return /^[0-9a-f]{32}$/.test(code) ? code : null;
}
export function caretakerGrantState(grant: Pick<CaretakerGrant, 'starts_at' | 'ends_at' | 'revoked_at' | 'caregiver_id'> & { accepted_at?: string | null }, now = Date.now()) {
  if (grant.revoked_at) return 'revoked';
  if (now >= Date.parse(grant.ends_at)) return 'ended';
  if (!grant.caregiver_id && !grant.accepted_at) return 'invited';
  if (now < Date.parse(grant.starts_at)) return 'scheduled';
  return 'active';
}
export function validateCaretakerPeriod(start: Date, end: Date, historyDays: number, now = Date.now()) {
  return Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) &&
    end.getTime() > start.getTime() && end.getTime() > now &&
    Number.isInteger(historyDays) && historyDays >= 0 && historyDays <= 2;
}
/** A response is displayed only for a short server-validated lease; never persisted. */
export function caretakerSnapshotLease(snapshot: Pick<CaretakerSnapshot, 'ends_at' | 'server_now'>, requestStartedAt: number) {
  const remaining = Date.parse(snapshot.ends_at) - Date.parse(snapshot.server_now);
  return requestStartedAt + Math.max(0, Math.min(remaining, 30_000));
}
