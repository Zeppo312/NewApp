import { supabase } from './supabase';

/**
 * Admin-Dashboard: Nutzungs- und Betriebskennzahlen sowie die Liste der
 * Verbesserungswünsche. Serverseitig hängt das an `get_admin_dashboard`,
 * `get_admin_feature_requests` und `admin_update_feature_request_status`
 * aus 20270819000000_admin_dashboard.sql.
 */

export type AdminFeatureGroup = 'community' | 'tracking' | 'premium' | 'moderation' | 'account';

export type AdminActivityEntry = {
  key: string;
  group: AdminFeatureGroup;
  /** false, wenn die Tabelle in dieser Datenbank fehlt. */
  available: boolean;
  total: number | null;
  period: number | null;
  last_at: string | null;
  /** Tagesdatum (YYYY-MM-DD) → Anzahl im Zeitraum. */
  daily: Record<string, number>;
};

export type AdminDashboard = {
  generated_at: string;
  range_days: number;
  since: string;
  users: {
    total?: number;
    new_in_period?: number;
    new_in_previous_period?: number;
    suspended?: number;
    terms_accepted?: number;
    admins?: number;
    with_push_token?: number;
  };
  moderation: {
    open?: number;
    resolved?: number;
    dismissed?: number;
    auto_filter?: number;
    from_block?: number;
    in_period?: number;
    follow_ups?: number;
    avg_hours_to_resolve?: number | null;
    oldest_open_hours?: number | null;
  };
  ai: {
    requests_in_period?: number;
    completed?: number;
    failed?: number;
    rejected?: number;
    avg_latency_ms?: number | null;
    last_error_code?: string | null;
    last_error_at?: string | null;
  };
  webhooks: {
    completed?: number;
    failed?: number;
    processing?: number;
    last_received_at?: string | null;
    last_failed_at?: string | null;
  };
  subscriptions: {
    premium_active?: number;
    expired?: number;
    total_tracked?: number;
    last_checked_at?: string | null;
  };
  activity: AdminActivityEntry[];
};

export type FeatureRequestStatus =
  | 'pending'
  | 'under_review'
  | 'planned'
  | 'completed'
  | 'rejected';

export type AdminFeatureRequest = {
  id: string;
  user_id: string;
  author_name: string;
  title: string;
  description: string;
  category: 'feature' | 'improvement' | 'bug-fix';
  priority: 'low' | 'medium' | 'high';
  status: FeatureRequestStatus;
  created_at: string;
  updated_at: string;
};

export type AdminResult = { success: boolean; error?: string };

export const getAdminDashboard = async (
  rangeDays = 7,
): Promise<{ data: AdminDashboard | null; error?: string }> => {
  try {
    const { data, error } = await supabase.rpc('get_admin_dashboard', {
      days_param: rangeDays,
    });

    if (error) {
      console.error('adminDashboard: failed to load metrics', error);
      return { data: null, error: error.message };
    }

    return { data: data as AdminDashboard };
  } catch (err) {
    console.error('adminDashboard: unexpected error loading metrics', err);
    return { data: null, error: 'unexpected_error' };
  }
};

export const getAdminFeatureRequests = async (
  status?: FeatureRequestStatus | null,
): Promise<AdminFeatureRequest[]> => {
  try {
    const { data, error } = await supabase.rpc('get_admin_feature_requests', {
      status_param: status ?? null,
      limit_param: 200,
    });

    if (error) {
      console.error('adminDashboard: failed to load feature requests', error);
      return [];
    }

    return (data || []) as AdminFeatureRequest[];
  } catch (err) {
    console.error('adminDashboard: unexpected error loading feature requests', err);
    return [];
  }
};

export const updateFeatureRequestStatus = async (
  requestId: string,
  status: FeatureRequestStatus,
): Promise<AdminResult> => {
  try {
    const { error } = await supabase.rpc('admin_update_feature_request_status', {
      request_id_param: requestId,
      status_param: status,
    });

    if (error) {
      console.error('adminDashboard: failed to update feature request', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('adminDashboard: unexpected error updating feature request', err);
    return { success: false, error: 'unexpected_error' };
  }
};

// ---------------------------------------------------------------------------
// Auswertung für die Anzeige
// ---------------------------------------------------------------------------

/**
 * Statusampel pro Feature. Reine Ableitung aus den Zahlen – kein eigener
 * Health-Check, sondern die Antwort auf „wurde das benutzt und wann zuletzt".
 */
export type FeatureHealth = 'active' | 'quiet' | 'stale' | 'missing';

const DAY_MS = 24 * 60 * 60 * 1000;

export const getFeatureHealth = (entry: AdminActivityEntry): FeatureHealth => {
  if (!entry.available) return 'missing';
  if ((entry.period ?? 0) > 0) return 'active';
  if (!entry.last_at) return 'stale';

  const lastMs = new Date(entry.last_at).getTime();
  if (Number.isNaN(lastMs)) return 'stale';

  return Date.now() - lastMs <= 30 * DAY_MS ? 'quiet' : 'stale';
};

export type SparklineBucket = {
  label: string;
  value: number;
};

/**
 * Baut die Balken für die Tagesreihe. Ab mehr als 31 Tagen wird auf
 * Wochenbündel zusammengefasst – 90 Ein-Pixel-Balken wären nicht lesbar.
 */
export const buildSparklineBuckets = (
  daily: Record<string, number>,
  since: string,
  rangeDays: number,
): SparklineBucket[] => {
  const sinceMs = new Date(since).getTime();
  const startMs = Number.isNaN(sinceMs) ? Date.now() - rangeDays * DAY_MS : sinceMs;
  const bucketSizeDays = rangeDays > 31 ? 7 : 1;
  const bucketCount = Math.ceil(rangeDays / bucketSizeDays);

  const buckets: SparklineBucket[] = Array.from({ length: bucketCount }, (_, index) => {
    const bucketStart = new Date(startMs + index * bucketSizeDays * DAY_MS);
    return {
      label: `${bucketStart.getDate()}.${bucketStart.getMonth() + 1}.`,
      value: 0,
    };
  });

  Object.entries(daily).forEach(([day, count]) => {
    const dayMs = new Date(`${day}T00:00:00Z`).getTime();
    if (Number.isNaN(dayMs)) return;

    const offsetDays = Math.floor((dayMs - startMs) / DAY_MS);
    const bucketIndex = Math.floor(offsetDays / bucketSizeDays);
    if (bucketIndex < 0 || bucketIndex >= buckets.length) return;

    buckets[bucketIndex].value += count;
  });

  return buckets;
};

/** Anteil fehlgeschlagener Ask-Lotti-Anfragen im Zeitraum, 0–1. */
export const getAiErrorRate = (ai: AdminDashboard['ai']): number | null => {
  const total = ai.requests_in_period ?? 0;
  if (total <= 0) return null;
  return (ai.failed ?? 0) / total;
};

/**
 * Verletzt die älteste offene Meldung die 24-Stunden-Zusage aus den
 * Nutzungsbedingungen? Das ist die betrieblich wichtigste Warnung.
 */
export const isModerationSlaBreached = (
  moderation: AdminDashboard['moderation'],
): boolean => (moderation.oldest_open_hours ?? 0) > 24;
