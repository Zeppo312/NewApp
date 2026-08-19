import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack } from 'expo-router';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { LAYOUT_PAD } from '@/constants/DesignGuide';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getCachedUserProfile, invalidateUserProfileCache } from '@/lib/appCache';
import {
  buildSparklineBuckets,
  getAdminDashboard,
  getAdminFeatureRequests,
  getAiErrorRate,
  getFeatureHealth,
  isModerationSlaBreached,
  updateFeatureRequestStatus,
  type AdminActivityEntry,
  type AdminDashboard,
  type AdminFeatureGroup,
  type AdminFeatureRequest,
  type FeatureHealth,
  type FeatureRequestStatus,
  type SparklineBucket,
} from '@/lib/adminDashboard';
import {
  translateAdminDashboardText,
  type AdminDashboardTranslationKey,
} from '@/lib/adminDashboardTranslations';

/**
 * Statusfarben sind reserviert: sie stehen nie für eine Datenreihe und treten
 * immer zusammen mit Symbol und Text auf, damit die Bedeutung nicht allein an
 * der Farbe hängt.
 */
const STATUS_COLORS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const;

type StatusTone = keyof typeof STATUS_COLORS;

const RANGE_OPTIONS: { days: number; labelKey: AdminDashboardTranslationKey }[] = [
  { days: 7, labelKey: 'range.7' },
  { days: 30, labelKey: 'range.30' },
  { days: 90, labelKey: 'range.90' },
];

const FEATURE_GROUPS: { group: AdminFeatureGroup; labelKey: AdminDashboardTranslationKey }[] = [
  { group: 'community', labelKey: 'group.community' },
  { group: 'tracking', labelKey: 'group.tracking' },
  { group: 'premium', labelKey: 'group.premium' },
  { group: 'moderation', labelKey: 'group.moderation' },
  { group: 'account', labelKey: 'group.account' },
];

const HEALTH_TONE: Record<FeatureHealth, StatusTone | null> = {
  active: 'good',
  quiet: 'warning',
  stale: null,
  missing: null,
};

const REQUEST_STATUSES: FeatureRequestStatus[] = [
  'pending',
  'under_review',
  'planned',
  'completed',
  'rejected',
];

// ─── Tagesreihe ──────────────────────────────────────────────────────────
// Ein Balken pro Tag (ab 31 Tagen pro Woche). Eine Datenreihe, eine Farbe –
// deshalb ohne Legende; der Zeilentitel sagt, was gezählt wird.
function FeatureSparkline({
  buckets,
  color,
  surfaceColor,
  gridColor,
  labelColor,
  peakLabel,
}: {
  buckets: SparklineBucket[];
  color: string;
  surfaceColor: string;
  gridColor: string;
  labelColor: string;
  peakLabel: string | null;
}) {
  const max = buckets.reduce((highest, bucket) => Math.max(highest, bucket.value), 0);

  if (buckets.length === 0) return null;

  return (
    <View style={styles.sparklineWrap}>
      {peakLabel ? (
        <ThemedText style={[styles.sparklinePeak, { color: labelColor }]}>{peakLabel}</ThemedText>
      ) : null}

      <View style={styles.sparklineRow}>
        {buckets.map((bucket, index) => {
          const ratio = max > 0 ? bucket.value / max : 0;
          return (
            <View
              key={`${bucket.label}-${index}`}
              style={[styles.sparklineSlot, { backgroundColor: surfaceColor }]}
            >
              <View
                style={[
                  styles.sparklineBar,
                  {
                    backgroundColor: color,
                    height: `${Math.max(ratio * 100, bucket.value > 0 ? 6 : 0)}%`,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      <View style={[styles.sparklineBaseline, { backgroundColor: gridColor }]} />

      <View style={styles.sparklineAxis}>
        <ThemedText style={[styles.sparklineAxisLabel, { color: labelColor }]}>
          {buckets[0]?.label}
        </ThemedText>
        <ThemedText style={[styles.sparklineAxisLabel, { color: labelColor }]}>
          {buckets[buckets.length - 1]?.label}
        </ThemedText>
      </View>
    </View>
  );
}

export default function AdminDashboardScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const isDark = colorScheme === 'dark';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const { locale, localeTag } = useLocale();

  const [isAuthorizing, setIsAuthorizing] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'metrics' | 'requests'>('metrics');
  const [rangeDays, setRangeDays] = useState(7);
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [requests, setRequests] = useState<AdminFeatureRequest[]>([]);
  const [requestFilter, setRequestFilter] = useState<FeatureRequestStatus | null>(null);
  const [isRequestsLoading, setIsRequestsLoading] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  const t = useCallback(
    (key: AdminDashboardTranslationKey, params?: Record<string, string | number>) =>
      translateAdminDashboardText(locale, key, params),
    [locale],
  );

  const textPrimary = isDark ? theme.textPrimary : '#5C4033';
  const textSecondary = isDark ? theme.textSecondary : '#7D5A50';
  const textMuted = isDark ? theme.textTertiary : '#9C8178';
  const surface = isDark ? '#1E1B22' : '#FFFFFF';
  const cardColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.85)';
  const cardBorderColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(125,90,80,0.08)';
  const gridColor = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(125,90,80,0.14)';
  const slotColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(125,90,80,0.05)';
  const barColor = theme.accent;

  useEffect(() => {
    let mounted = true;

    if (!user) {
      setIsAdmin(false);
      setIsAuthorizing(false);
      return () => {
        mounted = false;
      };
    }

    const loadAdminState = async () => {
      try {
        await invalidateUserProfileCache();
        const profile = await getCachedUserProfile();
        if (!mounted) return;
        setIsAdmin(profile?.is_admin === true);
      } catch (error) {
        console.error('Failed to load dashboard admin state:', error);
        if (mounted) setIsAdmin(false);
      } finally {
        if (mounted) setIsAuthorizing(false);
      }
    };

    void loadAdminState();

    return () => {
      mounted = false;
    };
  }, [user]);

  const loadDashboard = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    const { data, error } = await getAdminDashboard(rangeDays);
    setIsLoading(false);

    if (error) {
      const isMissing =
        error.includes('schema cache') ||
        error.includes('Could not find the function') ||
        error.includes('does not exist');
      setLoadError(isMissing ? t('rpcMissing') : t('loadFailed'));
      return;
    }

    setLoadError(null);
    setDashboard(data);
  }, [isAdmin, rangeDays, t]);

  const loadRequests = useCallback(async () => {
    if (!isAdmin) return;
    setIsRequestsLoading(true);
    const list = await getAdminFeatureRequests(requestFilter);
    setRequests(list);
    setIsRequestsLoading(false);
  }, [isAdmin, requestFilter]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (activeTab !== 'requests') return;
    void loadRequests();
  }, [activeTab, loadRequests]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([loadDashboard(), activeTab === 'requests' ? loadRequests() : null]);
    setIsRefreshing(false);
  }, [activeTab, loadDashboard, loadRequests]);

  const handleStatusChange = useCallback(
    async (request: AdminFeatureRequest, status: FeatureRequestStatus) => {
      if (request.status === status) return;

      setPendingRequestId(request.id);
      const result = await updateFeatureRequestStatus(request.id, status);
      setPendingRequestId(null);

      if (!result.success) {
        Alert.alert(t('common.error'), t('requests.updateFailed'));
        return;
      }

      await loadRequests();
    },
    [loadRequests, t],
  );

  const formatNumber = useCallback(
    (value?: number | null) =>
      value === null || value === undefined ? '–' : new Intl.NumberFormat(localeTag).format(value),
    [localeTag],
  );

  const formatDate = useCallback(
    (value?: string | null) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return date.toLocaleDateString(localeTag);
    },
    [localeTag],
  );

  const formatTime = useCallback(
    (value?: string | null) => {
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return `${date.toLocaleDateString(localeTag)} ${date.toLocaleTimeString(localeTag, {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    },
    [localeTag],
  );

  const activityByGroup = useMemo(() => {
    const grouped = new Map<AdminFeatureGroup, AdminActivityEntry[]>();
    (dashboard?.activity ?? []).forEach((entry) => {
      const list = grouped.get(entry.group) ?? [];
      list.push(entry);
      grouped.set(entry.group, list);
    });
    return grouped;
  }, [dashboard?.activity]);

  // ─── Bausteine ────────────────────────────────────────────────────────
  const renderStatusLine = (tone: StatusTone | null, icon: string, text: string, key: string) => (
    <View key={key} style={styles.statusLine}>
      <IconSymbol
        name={icon}
        size={17}
        color={tone ? STATUS_COLORS[tone] : textMuted}
      />
      <ThemedText style={[styles.statusLineText, { color: textSecondary }]}>{text}</ThemedText>
    </View>
  );

  const renderStatTile = (
    label: string,
    value: string,
    hint: string | null,
    tone: StatusTone | null,
  ) => (
    <View
      style={[styles.statTile, { backgroundColor: cardColor, borderColor: cardBorderColor }]}
      key={label}
    >
      <ThemedText style={[styles.statLabel, { color: textSecondary }]}>{label}</ThemedText>
      <ThemedText style={[styles.statValue, { color: tone ? STATUS_COLORS[tone] : textPrimary }]}>
        {value}
      </ThemedText>
      {hint ? (
        <ThemedText style={[styles.statHint, { color: textMuted }]}>{hint}</ThemedText>
      ) : null}
    </View>
  );

  const renderMetrics = () => {
    if (isLoading && !dashboard) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.accent} />
          <ThemedText style={[styles.centerStateText, { color: textSecondary }]}>
            {t('loading')}
          </ThemedText>
        </View>
      );
    }

    if (loadError) {
      return (
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: cardBorderColor }]}>
          <ThemedText style={[styles.cardTitle, { color: textPrimary }]}>
            {t('common.error')}
          </ThemedText>
          <ThemedText style={[styles.cardBody, { color: textSecondary }]}>{loadError}</ThemedText>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.accent }]}
            onPress={() => void loadDashboard()}
            activeOpacity={0.85}
          >
            <ThemedText style={styles.retryButtonText}>{t('common.retry')}</ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    if (!dashboard) return null;

    const { users, moderation, ai, webhooks, subscriptions } = dashboard;
    const aiErrorRate = getAiErrorRate(ai);
    const slaBreached = isModerationSlaBreached(moderation);
    const newUsers = users.new_in_period ?? 0;
    const previousUsers = users.new_in_previous_period ?? 0;
    const userDelta = newUsers - previousUsers;

    return (
      <>
        <View style={styles.rangeRow}>
          {RANGE_OPTIONS.map((option) => {
            const isActive = rangeDays === option.days;
            return (
              <TouchableOpacity
                key={option.days}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive ? theme.accent : cardColor,
                    borderColor: isActive ? theme.accent : cardBorderColor,
                  },
                ]}
                onPress={() => setRangeDays(option.days)}
                activeOpacity={0.85}
              >
                <ThemedText
                  style={[styles.chipText, { color: isActive ? '#FFFFFF' : textSecondary }]}
                >
                  {t(option.labelKey)}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>
        <ThemedText style={[styles.rangeHint, { color: textMuted }]}>
          {t('range.hint')} · {t('updatedAt', { time: formatTime(dashboard.generated_at) })}
        </ThemedText>

        {/* KPI-Reihe: einzelne Kennzahlen brauchen kein Diagramm */}
        <View style={styles.statGrid}>
          {renderStatTile(
            t('kpi.users'),
            formatNumber(users.total),
            userDelta === 0
              ? t('kpi.usersNew', { count: newUsers })
              : t('kpi.usersDelta', {
                  sign: userDelta > 0 ? '+' : '−',
                  count: Math.abs(userDelta),
                }),
            null,
          )}
          {renderStatTile(
            t('kpi.openReports'),
            formatNumber(moderation.open),
            (moderation.open ?? 0) === 0
              ? t('kpi.openReportsNone')
              : t('kpi.openReportsHint', { hours: moderation.oldest_open_hours ?? 0 }),
            slaBreached ? 'critical' : null,
          )}
          {renderStatTile(
            t('kpi.premium'),
            formatNumber(subscriptions.premium_active),
            t('kpi.premiumHint', { count: subscriptions.expired ?? 0 }),
            null,
          )}
          {renderStatTile(
            t('kpi.aiRequests'),
            formatNumber(ai.requests_in_period),
            (ai.requests_in_period ?? 0) === 0
              ? t('kpi.aiRequestsNone')
              : t('kpi.aiRequestsHint', {
                  failed: ai.failed ?? 0,
                  total: ai.requests_in_period ?? 0,
                }),
            aiErrorRate !== null && aiErrorRate > 0.2 ? 'critical' : null,
          )}
        </View>

        {/* Systemstatus: Symbol + Text, Farbe ist nur Verstärkung */}
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: cardBorderColor }]}>
          <ThemedText style={[styles.cardTitle, { color: textPrimary }]}>
            {t('health.title')}
          </ThemedText>

          {renderStatusLine(
            slaBreached ? 'critical' : 'good',
            slaBreached ? 'exclamationmark.triangle.fill' : 'checkmark.circle.fill',
            slaBreached
              ? t('health.slaBreached', { hours: moderation.oldest_open_hours ?? 0 })
              : t('health.slaOk'),
            'sla',
          )}

          {renderStatusLine(
            (users.with_push_token ?? 0) === 0 ? 'critical' : 'good',
            (users.with_push_token ?? 0) === 0
              ? 'exclamationmark.triangle.fill'
              : 'checkmark.circle.fill',
            (users.with_push_token ?? 0) === 0
              ? t('health.pushMissing')
              : t('health.pushCoverage', { count: users.with_push_token ?? 0 }),
            'push',
          )}

          {renderStatusLine(
            aiErrorRate === null ? null : aiErrorRate > 0.2 ? 'critical' : aiErrorRate > 0 ? 'warning' : 'good',
            aiErrorRate === null
              ? 'circle'
              : aiErrorRate > 0
                ? 'exclamationmark.triangle.fill'
                : 'checkmark.circle.fill',
            aiErrorRate === null
              ? t('health.aiIdle')
              : aiErrorRate > 0
                ? t('health.aiErrors', { percent: Math.round(aiErrorRate * 100) })
                : t('health.aiOk'),
            'ai',
          )}

          {ai.avg_latency_ms
            ? renderStatusLine(
                null,
                'clock',
                t('health.aiLatency', { ms: formatNumber(ai.avg_latency_ms) }),
                'latency',
              )
            : null}

          {ai.last_error_code
            ? renderStatusLine(
                'serious',
                'exclamationmark.triangle',
                t('health.aiLastError', {
                  code: ai.last_error_code,
                  date: formatDate(ai.last_error_at) ?? '–',
                }),
                'lastError',
              )
            : null}

          {renderStatusLine(
            (webhooks.failed ?? 0) > 0 ? 'critical' : (webhooks.completed ?? 0) > 0 ? 'good' : null,
            (webhooks.failed ?? 0) > 0
              ? 'exclamationmark.triangle.fill'
              : (webhooks.completed ?? 0) > 0
                ? 'checkmark.circle.fill'
                : 'circle',
            (webhooks.failed ?? 0) > 0
              ? t('health.webhookFailed', { count: webhooks.failed ?? 0 })
              : (webhooks.completed ?? 0) > 0
                ? t('health.webhookOk')
                : t('health.webhookIdle'),
            'webhooks',
          )}

          {(webhooks.processing ?? 0) > 0
            ? renderStatusLine(
                'warning',
                'exclamationmark.triangle',
                t('health.webhookStuck', { count: webhooks.processing ?? 0 }),
                'webhookStuck',
              )
            : null}

          {renderStatusLine(
            null,
            'checkmark.circle',
            t('health.consent', { count: users.terms_accepted ?? 0 }),
            'consent',
          )}
        </View>

        {/* Moderation */}
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: cardBorderColor }]}>
          <ThemedText style={[styles.cardTitle, { color: textPrimary }]}>
            {t('moderation.title')}
          </ThemedText>
          <View style={styles.miniGrid}>
            {[
              { label: t('moderation.inPeriod'), value: moderation.in_period },
              { label: t('moderation.resolved'), value: moderation.resolved },
              { label: t('moderation.dismissed'), value: moderation.dismissed },
              { label: t('moderation.autoFilter'), value: moderation.auto_filter },
              { label: t('moderation.fromBlock'), value: moderation.from_block },
              { label: t('moderation.followUps'), value: moderation.follow_ups },
              { label: t('moderation.suspended'), value: users.suspended },
              {
                label: t('moderation.avgResolve'),
                value: moderation.avg_hours_to_resolve,
                suffix: true,
              },
            ].map((item) => (
              <View key={item.label} style={styles.miniItem}>
                <ThemedText style={[styles.miniValue, { color: textPrimary }]}>
                  {item.suffix && item.value !== null && item.value !== undefined
                    ? t('moderation.hours', { value: item.value })
                    : formatNumber(item.value)}
                </ThemedText>
                <ThemedText style={[styles.miniLabel, { color: textMuted }]}>
                  {item.label}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        {/* Aktivität pro Feature */}
        {FEATURE_GROUPS.map(({ group, labelKey }) => {
          const entries = activityByGroup.get(group) ?? [];
          if (entries.length === 0) return null;

          return (
            <View key={group} style={styles.groupSection}>
              <ThemedText style={[styles.groupTitle, { color: textSecondary }]}>
                {t(labelKey)}
              </ThemedText>

              {entries.map((entry) => {
                const health = getFeatureHealth(entry);
                const tone = HEALTH_TONE[health];
                const buckets = buildSparklineBuckets(
                  entry.daily,
                  dashboard.since,
                  dashboard.range_days,
                );
                const peak = buckets.reduce(
                  (highest, bucket) => Math.max(highest, bucket.value),
                  0,
                );
                const lastAt = formatDate(entry.last_at);

                return (
                  <View
                    key={entry.key}
                    style={[
                      styles.featureCard,
                      { backgroundColor: cardColor, borderColor: cardBorderColor },
                    ]}
                  >
                    <View style={styles.featureHeader}>
                      <ThemedText
                        style={[styles.featureTitle, { color: textPrimary }]}
                        numberOfLines={1}
                      >
                        {t(`label.${entry.key}` as AdminDashboardTranslationKey)}
                      </ThemedText>
                      <View style={styles.featureStatus}>
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: tone ? STATUS_COLORS[tone] : textMuted },
                          ]}
                        />
                        <ThemedText style={[styles.statusText, { color: textMuted }]}>
                          {t(`status.${health}` as AdminDashboardTranslationKey)}
                        </ThemedText>
                      </View>
                    </View>

                    {entry.available ? (
                      <>
                        <ThemedText style={[styles.featureMeta, { color: textSecondary }]}>
                          {t('feature.period', { count: entry.period ?? 0 })} ·{' '}
                          {t('feature.total', { count: formatNumber(entry.total) })}
                          {lastAt ? ` · ${t('feature.lastAt', { date: lastAt })}` : ` · ${t('feature.never')}`}
                        </ThemedText>

                        <FeatureSparkline
                          buckets={buckets}
                          color={barColor}
                          surfaceColor={slotColor}
                          gridColor={gridColor}
                          labelColor={textMuted}
                          peakLabel={peak > 0 ? t('feature.peak', { count: peak }) : null}
                        />
                      </>
                    ) : (
                      <ThemedText style={[styles.featureMeta, { color: textMuted }]}>
                        {t('feature.missing')}
                      </ThemedText>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
      </>
    );
  };

  const renderRequests = () => {
    if (isRequestsLoading && requests.length === 0) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.accent} />
          <ThemedText style={[styles.centerStateText, { color: textSecondary }]}>
            {t('requests.loading')}
          </ThemedText>
        </View>
      );
    }

    return (
      <>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {[null, ...REQUEST_STATUSES].map((status) => {
            const isActive = requestFilter === status;
            const label =
              status === null
                ? t('requests.filterAll')
                : t(`requests.status.${status}` as AdminDashboardTranslationKey);

            return (
              <TouchableOpacity
                key={status ?? 'all'}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isActive ? theme.accent : cardColor,
                    borderColor: isActive ? theme.accent : cardBorderColor,
                  },
                ]}
                onPress={() => setRequestFilter(status)}
                activeOpacity={0.85}
              >
                <ThemedText
                  style={[styles.chipText, { color: isActive ? '#FFFFFF' : textSecondary }]}
                >
                  {label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {requests.length === 0 ? (
          <View style={[styles.card, { backgroundColor: cardColor, borderColor: cardBorderColor }]}>
            <ThemedText style={[styles.cardTitle, { color: textPrimary }]}>
              {t('requests.empty')}
            </ThemedText>
            <ThemedText style={[styles.cardBody, { color: textSecondary }]}>
              {t('requests.emptyHint')}
            </ThemedText>
          </View>
        ) : (
          <>
            <ThemedText style={[styles.groupTitle, { color: textSecondary }]}>
              {t('requests.count', { count: requests.length })}
            </ThemedText>

            {requests.map((request) => {
              const isPending = pendingRequestId === request.id;

              return (
                <View
                  key={request.id}
                  style={[
                    styles.card,
                    { backgroundColor: cardColor, borderColor: cardBorderColor },
                  ]}
                >
                  <View style={styles.requestHeader}>
                    <ThemedText style={[styles.requestTitle, { color: textPrimary }]}>
                      {request.title}
                    </ThemedText>
                    {request.priority === 'high' ? (
                      <View style={[styles.priorityBadge, { backgroundColor: STATUS_COLORS.serious }]}>
                        <ThemedText style={styles.priorityBadgeText}>
                          {t('requests.priority.high')}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>

                  <ThemedText style={[styles.requestMeta, { color: textMuted }]}>
                    {t(`requests.category.${request.category}` as AdminDashboardTranslationKey)} ·{' '}
                    {t(`requests.priority.${request.priority}` as AdminDashboardTranslationKey)} ·{' '}
                    {t('requests.by', { name: request.author_name })} ·{' '}
                    {formatDate(request.created_at) ?? ''}
                  </ThemedText>

                  <ThemedText style={[styles.cardBody, { color: textSecondary }]}>
                    {request.description}
                  </ThemedText>

                  <ThemedText style={[styles.requestStatusLabel, { color: textMuted }]}>
                    {t('requests.statusLabel')}
                  </ThemedText>

                  {isPending ? (
                    <ActivityIndicator style={styles.pendingSpinner} color={theme.accent} />
                  ) : (
                    <View style={styles.statusChipRow}>
                      {REQUEST_STATUSES.map((status) => {
                        const isActive = request.status === status;
                        return (
                          <TouchableOpacity
                            key={status}
                            style={[
                              styles.statusChip,
                              {
                                backgroundColor: isActive ? theme.accent : 'transparent',
                                borderColor: isActive ? theme.accent : cardBorderColor,
                              },
                            ]}
                            onPress={() => void handleStatusChange(request, status)}
                            activeOpacity={0.85}
                          >
                            <ThemedText
                              style={[
                                styles.statusChipText,
                                { color: isActive ? '#FFFFFF' : textSecondary },
                              ]}
                            >
                              {t(`requests.status.${status}` as AdminDashboardTranslationKey)}
                            </ThemedText>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
      </>
    );
  };

  const renderBody = () => {
    if (isAuthorizing) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      );
    }

    if (!isAdmin) {
      return (
        <View style={[styles.card, { backgroundColor: cardColor, borderColor: cardBorderColor }]}>
          <IconSymbol name="lock.shield" size={30} color={textSecondary} />
          <ThemedText style={[styles.cardTitle, { color: textPrimary }]}>
            {t('accessDenied')}
          </ThemedText>
        </View>
      );
    }

    return (
      <>
        <View style={styles.tabRow}>
          {(['metrics', 'requests'] as const).map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  {
                    backgroundColor: isActive ? theme.accent : cardColor,
                    borderColor: isActive ? theme.accent : cardBorderColor,
                  },
                ]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.85}
              >
                <ThemedText
                  style={[styles.tabText, { color: isActive ? '#FFFFFF' : textSecondary }]}
                >
                  {t(tab === 'metrics' ? 'tab.metrics' : 'tab.requests')}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 'metrics' ? renderMetrics() : renderRequests()}
      </>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <Header title={t('title')} subtitle={t('subtitle')} showBackButton />
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={() => void handleRefresh()}
                tintColor={theme.accent}
              />
            }
          >
            {renderBody()}
          </ScrollView>
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 40,
    paddingTop: 10,
    gap: 12,
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  centerStateText: {
    fontSize: 15,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
  },
  rangeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  rangeHint: {
    fontSize: 11,
    lineHeight: 16,
  },
  chip: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterScroll: {
    paddingRight: 8,
    paddingBottom: 4,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: '46%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
  },
  statHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 10,
    borderRadius: 16,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  statusLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 8,
  },
  statusLineText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  miniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  miniItem: {
    width: '33%',
    paddingVertical: 8,
    paddingRight: 8,
  },
  miniValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  miniLabel: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  groupSection: {
    gap: 8,
    marginTop: 6,
  },
  groupTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  featureCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  featureStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  featureMeta: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  sparklineWrap: {
    marginTop: 10,
  },
  sparklinePeak: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  sparklineRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 46,
    gap: 2,
  },
  sparklineSlot: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    maxWidth: 24,
    borderRadius: 2,
  },
  sparklineBar: {
    width: '100%',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  sparklineBaseline: {
    height: 1,
    marginTop: 2,
  },
  sparklineAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sparklineAxisLabel: {
    fontSize: 10,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  priorityBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  priorityBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  requestMeta: {
    fontSize: 11,
    lineHeight: 16,
  },
  requestStatusLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 8,
  },
  statusChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  statusChip: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pendingSpinner: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
});
