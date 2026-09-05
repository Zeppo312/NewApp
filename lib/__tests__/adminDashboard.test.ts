import {
  buildSparklineBuckets,
  getAiErrorRate,
  getFeatureHealth,
  isModerationSlaBreached,
  type AdminActivityEntry,
} from '../adminDashboard';
import { translateAdminDashboardText } from '../adminDashboardTranslations';

const DAY_MS = 24 * 60 * 60 * 1000;

const entry = (overrides: Partial<AdminActivityEntry>): AdminActivityEntry => ({
  key: 'community_posts',
  group: 'community',
  available: true,
  total: 10,
  period: 0,
  last_at: null,
  daily: {},
  ...overrides,
});

describe('admin dashboard evaluation', () => {
  describe('getFeatureHealth', () => {
    it('markiert fehlende Tabellen', () => {
      expect(getFeatureHealth(entry({ available: false, total: null }))).toBe('missing');
    });

    it('markiert Nutzung im Zeitraum als aktiv', () => {
      expect(getFeatureHealth(entry({ period: 3 }))).toBe('active');
    });

    it('unterscheidet ruhig von inaktiv anhand des letzten Eintrags', () => {
      const recent = new Date(Date.now() - 10 * DAY_MS).toISOString();
      const old = new Date(Date.now() - 60 * DAY_MS).toISOString();

      expect(getFeatureHealth(entry({ period: 0, last_at: recent }))).toBe('quiet');
      expect(getFeatureHealth(entry({ period: 0, last_at: old }))).toBe('stale');
    });

    it('behandelt fehlende und unbrauchbare Zeitstempel als inaktiv', () => {
      expect(getFeatureHealth(entry({ period: 0, last_at: null }))).toBe('stale');
      expect(getFeatureHealth(entry({ period: 0, last_at: 'kaputt' }))).toBe('stale');
    });
  });

  describe('buildSparklineBuckets', () => {
    it('legt einen Balken pro Tag an und ordnet die Zähler zu', () => {
      const since = '2026-08-10T00:00:00Z';
      const buckets = buildSparklineBuckets(
        { '2026-08-10': 2, '2026-08-12': 5 },
        since,
        3,
      );

      expect(buckets).toHaveLength(3);
      expect(buckets[0].value).toBe(2);
      expect(buckets[1].value).toBe(0);
      expect(buckets[2].value).toBe(5);
    });

    it('bündelt lange Zeiträume auf Wochen, damit die Balken lesbar bleiben', () => {
      const since = '2026-06-01T00:00:00Z';
      const buckets = buildSparklineBuckets(
        { '2026-06-01': 1, '2026-06-03': 2, '2026-06-09': 4 },
        since,
        90,
      );

      // 90 Tage / 7 = 13 Bündel; die erste Woche fasst 1 + 2 zusammen.
      expect(buckets).toHaveLength(13);
      expect(buckets[0].value).toBe(3);
      expect(buckets[1].value).toBe(4);
    });

    it('ignoriert Tage außerhalb des Zeitraums', () => {
      const buckets = buildSparklineBuckets(
        { '2026-01-01': 99, '2026-08-10': 1 },
        '2026-08-10T00:00:00Z',
        2,
      );

      expect(buckets.reduce((sum, bucket) => sum + bucket.value, 0)).toBe(1);
    });

    it('kommt mit leeren Daten klar', () => {
      const buckets = buildSparklineBuckets({}, '2026-08-10T00:00:00Z', 7);
      expect(buckets).toHaveLength(7);
      expect(buckets.every((bucket) => bucket.value === 0)).toBe(true);
    });
  });

  describe('getAiErrorRate', () => {
    it('liefert null ohne Anfragen', () => {
      expect(getAiErrorRate({ requests_in_period: 0, failed: 0 })).toBeNull();
      expect(getAiErrorRate({})).toBeNull();
    });

    it('berechnet den Fehleranteil', () => {
      expect(getAiErrorRate({ requests_in_period: 10, failed: 2 })).toBeCloseTo(0.2);
      expect(getAiErrorRate({ requests_in_period: 4, failed: 0 })).toBe(0);
    });
  });

  describe('isModerationSlaBreached', () => {
    it('schlägt erst über 24 Stunden an', () => {
      expect(isModerationSlaBreached({ oldest_open_hours: 23.9 })).toBe(false);
      expect(isModerationSlaBreached({ oldest_open_hours: 24 })).toBe(false);
      expect(isModerationSlaBreached({ oldest_open_hours: 24.1 })).toBe(true);
    });

    it('ist ohne offene Meldung nicht verletzt', () => {
      expect(isModerationSlaBreached({})).toBe(false);
      expect(isModerationSlaBreached({ oldest_open_hours: null })).toBe(false);
    });
  });

  describe('translations', () => {
    it('benennt jedes Feature aus der Dashboard-Abfrage', () => {
      const featureKeys = [
        'community_posts',
        'community_comments',
        'community_nested_comments',
        'community_groups',
        'community_group_posts',
        'community_group_messages',
        'direct_messages',
        'user_follows',
        'sleep_entries_new',
        'baby_care_entries',
        'baby_diary',
        'weight_entries',
        'size_entries',
        'tooth_entries',
        'selfcare_entries',
        'baby_milestone_entries',
        'doctor_questions',
        'geburtsplan',
        'shopping_list_items',
        'inventory_items',
        'planner_recurring_items',
        'lotti_ai_requests',
        'voice_log_requests',
        'advisor_messages',
        'advisor_mama_checkins',
        'lotti_recommendations',
        'content_reports',
        'user_blocks',
        'profiles',
        'account_links',
        'feature_requests',
      ] as const;

      featureKeys.forEach((key) => {
        const translationKey = `label.${key}` as const;
        expect(translateAdminDashboardText('de', translationKey)).not.toBe(translationKey);
        expect(translateAdminDashboardText('en', translationKey)).not.toBe(translationKey);
        expect(translateAdminDashboardText('es', translationKey)).not.toBe(translationKey);
      });
    });

    it('füllt Platzhalter', () => {
      expect(translateAdminDashboardText('de', 'health.slaBreached', { hours: 30 })).toContain('30');
      expect(translateAdminDashboardText('en', 'kpi.usersNew', { count: 4 })).toContain('4');
    });
  });
});
