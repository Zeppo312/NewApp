import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { GlassCard } from '@/components/ui/GlassCard';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { ThemedText } from '@/components/ThemedText';
import {
  buildCareAnalyticsReport,
  getCareAnalyticsEarliestDate,
  type CareAnalyticsPeriod,
  type CareAnalyticsReport,
  type CareMetricKey,
  type CareTrendPoint,
} from '@/lib/advisor/careAnalytics';
import type { SleepEntry } from '@/lib/sleepData';
import { loadAllVisibleSleepEntries } from '@/lib/sleepSharing';
import { getBabyCareEntriesForDateRange, type BabyCareEntry } from '@/lib/supabase';
import { useLocale } from '@/contexts/LocaleContext';
import { translateAdvisor, type AdvisorTranslationKey } from '@/lib/advisor/advisorTranslations';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

const PURPLE = '#5E3DB3';
const PURPLE_SOFT = '#8E4EC6';
const PINK = '#C96892';
const TEAL = '#3F9D91';
const TEXT_PRIMARY = '#4A3A33';
const TEXT_SECONDARY = '#7D5A50';
const TEXT_TERTIARY = '#9C8178';

type AnalyticsTheme = {
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentSoft: string;
  accentSurface: string;
  divider: string;
  raisedSurface: string;
  controlSurface: string;
  controlBorder: string;
  previousLine: string;
  pointFill: string;
};

const METRICS: { key: CareMetricKey; color: string }[] = [
  { key: 'sleep', color: PURPLE },
  { key: 'feeding', color: PINK },
  { key: 'diaper', color: TEAL },
];

const metricColor = (key: CareMetricKey, isDark = false) => {
  if (isDark) {
    if (key === 'sleep') return '#B8ADFF';
    if (key === 'feeding') return '#F2A7C5';
    if (key === 'diaper') return '#83D4C8';
  }
  return METRICS.find((metric) => metric.key === key)?.color ?? PURPLE;
};

const formatValue = (metric: CareMetricKey, value: number | null, localeTag: string) => {
  if (value === null) return '–';
  if (metric === 'sleep') {
    const minutes = Math.round(value);
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours > 0 ? `${hours}h ${String(rest).padStart(2, '0')}m` : `${rest} Min`;
  }
  return value.toLocaleString(localeTag, { maximumFractionDigits: 1 });
};

const changeText = (value: number | null, t: (key: AdvisorTranslationKey, params?: Record<string, string | number>) => string) => {
  if (value === null) return t('comparisonLearning');
  const rounded = Math.round(Math.abs(value));
  if (rounded < 3) return t('stable');
  return t('change', { arrow: value >= 0 ? '↑' : '↓', percent: rounded });
};

const pointValue = (point: CareTrendPoint, metric: CareMetricKey) => point[metric];

function TrendChart({
  report,
  metric,
  width,
  metricLabel,
  theme,
}: {
  report: CareAnalyticsReport;
  metric: CareMetricKey;
  width: number;
  metricLabel: string;
  theme: AnalyticsTheme;
}) {
  const height = 178;
  const top = 16;
  const bottom = 28;
  const plotHeight = height - top - bottom;
  const values = [...report.currentTrend, ...report.previousTrend]
    .map((point) => pointValue(point, metric))
    .filter((value): value is number => value !== null);
  const max = Math.max(...values, 1);
  const xFor = (index: number, count: number) =>
    count <= 1 ? width / 2 : 7 + (index / (count - 1)) * (width - 14);
  const yFor = (value: number) => top + plotHeight - (value / max) * plotHeight;
  const makePath = (points: CareTrendPoint[]) => {
    let path = '';
    let drawing = false;
    points.forEach((point, index) => {
      const value = pointValue(point, metric);
      if (value === null) {
        drawing = false;
        return;
      }
      path += `${drawing ? ' L' : ' M'} ${xFor(index, points.length).toFixed(1)} ${yFor(value).toFixed(1)}`;
      drawing = true;
    });
    return path;
  };
  const currentPath = makePath(report.currentTrend);
  const previousPath = makePath(report.previousTrend);
  const labelEvery = report.currentTrend.length > 14 ? 5 : report.currentTrend.length > 8 ? 2 : 1;

  return (
    <View accessibilityLabel={metricLabel}>
      <Svg width={width} height={height}>
        {[0, 0.5, 1].map((fraction) => {
          const y = top + plotHeight * fraction;
          return <Line key={fraction} x1={0} x2={width} y1={y} y2={y} stroke={theme.divider} strokeWidth={1} />;
        })}
        {previousPath ? (
          <Path
            d={previousPath}
            fill="none"
            stroke={theme.previousLine}
            strokeWidth={2}
            strokeDasharray="5 5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {currentPath ? (
          <Path
            d={currentPath}
            fill="none"
            stroke={metricColor(metric, theme.isDark)}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {report.currentTrend.map((point, index) => {
          const value = pointValue(point, metric);
          return value === null ? null : (
            <Circle
              key={point.key}
              cx={xFor(index, report.currentTrend.length)}
              cy={yFor(value)}
              r={report.currentTrend.length > 14 ? 2.2 : 3}
              fill={theme.pointFill}
              stroke={metricColor(metric, theme.isDark)}
              strokeWidth={2}
            />
          );
        })}
        {report.currentTrend.map((point, index) =>
          point.label && (index % labelEvery === 0 || index === report.currentTrend.length - 1) ? (
            <SvgText
              key={`${point.key}-label`}
              x={xFor(index, report.currentTrend.length)}
              y={height - 5}
              fontSize={9.5}
              fill={theme.textTertiary}
              textAnchor={index === 0 ? 'start' : index === report.currentTrend.length - 1 ? 'end' : 'middle'}
            >
              {point.label}
            </SvgText>
          ) : null,
        )}
      </Svg>
    </View>
  );
}

function RelationshipPlot({ report, width, feedingLabel, diaperLabel, sleepLabel, theme }: { report: CareAnalyticsReport; width: number; feedingLabel: string; diaperLabel: string; sleepLabel: string; theme: AnalyticsTheme }) {
  const relationship = report.relationship;
  if (relationship.coefficient === null) return null;
  const height = 142;
  const inset = 12;
  const sampled = relationship.points.length > 50
    ? relationship.points.filter((_point, index) => index % Math.ceil(relationship.points.length / 50) === 0)
    : relationship.points;
  const maxX = Math.max(...sampled.map((point) => point.x), 1);
  const maxY = Math.max(...sampled.map((point) => point.y), 1);
  return (
    <Svg width={width} height={height}>
      <Line x1={inset} x2={inset} y1={inset} y2={height - 22} stroke={theme.divider} strokeWidth={1} />
      <Line x1={inset} x2={width - inset} y1={height - 22} y2={height - 22} stroke={theme.divider} strokeWidth={1} />
      {sampled.map((point) => (
        <Circle
          key={point.key}
          cx={inset + (point.x / maxX) * (width - inset * 2)}
          cy={inset + (1 - point.y / maxY) * (height - 34)}
          r={4}
          fill={theme.accentSurface}
          stroke={theme.accent}
          strokeWidth={1.2}
        />
      ))}
      <SvgText x={inset} y={height - 5} fontSize={9.5} fill={theme.textTertiary}>
        {relationship.x === 'feeding' ? `${feedingLabel} →` : `${diaperLabel} →`}
      </SvgText>
      <SvgText x={width - inset} y={13} fontSize={9.5} fill={theme.textTertiary} textAnchor="end">
        {relationship.y === 'sleep' ? `${sleepLabel} ↑` : `${diaperLabel} ↑`}
      </SvgText>
    </Svg>
  );
}

export function CareAnalyticsSection({ babyId }: { babyId?: string | null }) {
  const { locale, localeTag } = useLocale();
  const adaptiveColors = useAdaptiveColors();
  const isDark =
    adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const theme = useMemo<AnalyticsTheme>(
    () => ({
      isDark,
      textPrimary: isDark ? adaptiveColors.textPrimary : TEXT_PRIMARY,
      textSecondary: isDark ? adaptiveColors.textSecondary : TEXT_SECONDARY,
      textTertiary: isDark ? adaptiveColors.textTertiary : TEXT_TERTIARY,
      accent: isDark ? '#C8B3FF' : PURPLE,
      accentSoft: isDark ? '#A98BFA' : PURPLE_SOFT,
      accentSurface: isDark ? 'rgba(200,179,255,0.16)' : 'rgba(94,61,179,0.10)',
      divider: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(74,58,51,0.12)',
      raisedSurface: isDark ? 'rgba(255,255,255,0.085)' : 'rgba(255,255,255,0.58)',
      controlSurface: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(94,61,179,0.09)',
      controlBorder: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(74,58,51,0.12)',
      previousLine: isDark ? 'rgba(255,255,255,0.32)' : 'rgba(74,58,51,0.30)',
      pointFill: isDark ? '#18131F' : '#FFFFFF',
    }),
    [adaptiveColors, isDark],
  );
  const styles = useMemo(() => createStyles(theme), [theme]);
  const tileProps = useMemo(
    () =>
      isDark
        ? {
            tint: 'dark' as const,
            intensity: 38,
            frostColor: 'rgba(18,15,24,0.78)',
            toneColor: 'rgba(72,51,101,0.16)',
            borderColor: 'rgba(255,255,255,0.17)',
            innerBorderColor: 'rgba(255,255,255,0.07)',
            highlightStrength: 'subtle' as const,
            highlightOpacity: 0.55,
            glossOpacity: 0.12,
            grainOpacity: 0.025,
            shadeOpacity: 0.75,
          }
        : {
            tint: 'light' as const,
            frostColor: 'rgba(255,255,255,0.55)',
            borderColor: 'rgba(255,255,255,0.9)',
            innerBorderColor: 'rgba(255,255,255,0.5)',
            highlightStrength: 'strong' as const,
            highlightOpacity: 1,
            glossOpacity: 0.5,
            grainOpacity: 0.04,
            shadeOpacity: 0.5,
          },
    [isDark],
  );
  const t = (key: AdvisorTranslationKey, params?: Record<string, string | number>) => translateAdvisor(locale, key, params);
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = Math.max(230, Math.min(560, windowWidth - 80));
  const [period, setPeriod] = useState<CareAnalyticsPeriod>('week');
  const [metric, setMetric] = useState<CareMetricKey>('sleep');
  const [careEntries, setCareEntries] = useState<BabyCareEntry[]>([]);
  const [sleepEntries, setSleepEntries] = useState<SleepEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const load = async () => {
        if (!babyId) {
          setCareEntries([]);
          setSleepEntries([]);
          setLoading(false);
          return;
        }
        setLoading(true);
        setLoadFailed(false);
        const now = new Date();
        const [careResult, sleepResult] = await Promise.all([
          getBabyCareEntriesForDateRange(getCareAnalyticsEarliestDate(now), now, babyId),
          loadAllVisibleSleepEntries(babyId),
        ]);
        if (cancelled) return;
        const nextCare = Array.isArray(careResult.data) ? careResult.data : [];
        const nextSleep = sleepResult.success && Array.isArray(sleepResult.entries) ? sleepResult.entries : [];
        setCareEntries(nextCare);
        setSleepEntries(nextSleep);
        setLoadFailed(Boolean(careResult.error) && !sleepResult.success);
        setLoading(false);
      };
      void load();
      return () => {
        cancelled = true;
      };
    }, [babyId]),
  );

  const report = useMemo(
    () => buildCareAnalyticsReport({ period, careEntries, sleepEntries, locale }),
    [careEntries, locale, period, sleepEntries],
  );

  const select = (callback: () => void) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    callback();
  };

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingIcon}>
          <IconSymbol name="chart.line.uptrend.xyaxis" size={18} color={theme.accent} />
        </View>
        <View style={styles.headingText}>
          <ThemedText adaptive={false} style={styles.headingTitle}>{t('analyticsTitle')}</ThemedText>
          <ThemedText adaptive={false} style={styles.headingHint}>{t('analyticsHint')}</ThemedText>
        </View>
      </View>

      <View style={styles.periodControl}>
        {([
          { key: 'week', label: t('week') },
          { key: 'month', label: t('month') },
          { key: 'year', label: t('year') },
        ] as { key: CareAnalyticsPeriod; label: string }[]).map((item) => {
          const active = period === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => select(() => setPeriod(item.key))}
              style={[styles.periodButton, active && styles.periodButtonActive]}
            >
              <Text style={[styles.periodText, active && styles.periodTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <GlassCard {...tileProps} radius={26} contentStyle={styles.reportContent}>
        <View style={styles.reportHeader}>
          <View style={styles.reportHeaderText}>
            <ThemedText adaptive={false} style={styles.reportEyebrow}>{report.title}</ThemedText>
            <ThemedText adaptive={false} style={styles.reportTitle}>{report.headline}</ThemedText>
            <ThemedText adaptive={false} style={styles.rangeLabel}>{report.rangeLabel}</ThemedText>
          </View>
          <View style={styles.coverageBadge}>
            <Text style={styles.coverageNumber}>{report.coverageDays}</Text>
            <Text style={styles.coverageText}>/{report.totalDays} {t('days')}</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={theme.accent} />
            <ThemedText adaptive={false} style={styles.loadingText}>{t('reportLoading')}</ThemedText>
          </View>
        ) : loadFailed ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyEmoji}>☁️</Text>
            <ThemedText adaptive={false} style={styles.emptyTitle}>{t('dataUnavailable')}</ThemedText>
            <ThemedText adaptive={false} style={styles.emptyText}>{t('dataUnavailableText')}</ThemedText>
          </View>
        ) : !report.hasData ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <ThemedText adaptive={false} style={styles.emptyTitle}>{t('reportGrowing')}</ThemedText>
            <ThemedText adaptive={false} style={styles.emptyText}>{t('reportGrowingText')}</ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.summaryGrid}>
              {report.summaries.map((summary) => (
                <View key={summary.key} style={styles.summaryCard}>
                  <View style={styles.summaryLabelRow}>
                    <Text style={styles.summaryEmoji}>{summary.emoji}</Text>
                    <Text style={styles.summaryLabel}>{summary.label}</Text>
                  </View>
                  <Text selectable style={[styles.summaryValue, { color: metricColor(summary.key, isDark) }]}>
                    {formatValue(summary.key, summary.value, localeTag)}
                  </Text>
                  <Text style={styles.summaryChange}>{changeText(summary.changePercent, t)}</Text>
                  <Text style={styles.summarySample}>{t('averageDays', { count: summary.recordedDays })}</Text>
                </View>
              ))}
            </View>

            <View style={styles.divider} />

            <View style={styles.chartHeader}>
              <View>
                <ThemedText adaptive={false} style={styles.blockTitle}>{t('trend')}</ThemedText>
                <ThemedText adaptive={false} style={styles.blockHint}>{t('trendHint', { comparison: report.comparisonLabel })}</ThemedText>
              </View>
            </View>
            <View style={styles.metricControl}>
              {METRICS.map((item) => {
                const active = metric === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    activeOpacity={0.8}
                    onPress={() => select(() => setMetric(item.key))}
                    style={[
                      styles.metricButton,
                      active && {
                        backgroundColor: `${metricColor(item.key, isDark)}22`,
                        borderColor: `${metricColor(item.key, isDark)}55`,
                      },
                    ]}
                  >
                    <View style={[styles.metricDot, { backgroundColor: metricColor(item.key, isDark) }]} />
                    <Text style={[styles.metricText, active && { color: metricColor(item.key, isDark) }]}>{t(item.key === 'feeding' ? 'meals' : item.key)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TrendChart report={report} metric={metric} width={chartWidth} metricLabel={t('chartHistory', { metric: t(metric === 'feeding' ? 'meals' : metric) })} theme={theme} />

            <View style={styles.insightBlock}>
              <View style={styles.insightTitleRow}>
                <IconSymbol name="sparkles" size={14} color={theme.accent} />
                <ThemedText adaptive={false} style={styles.insightTitle}>{t('noticeable')}</ThemedText>
              </View>
              {report.insightLines.map((line) => (
                <View key={line} style={styles.insightRow}>
                  <View style={styles.insightDot} />
                  <ThemedText adaptive={false} style={styles.insightText}>{line}</ThemedText>
                </View>
              ))}
            </View>

            <View style={styles.relationshipBlock}>
              <View style={styles.relationshipHeader}>
                <View>
                  <ThemedText adaptive={false} style={styles.blockTitle}>{t('together')}</ThemedText>
                  <ThemedText adaptive={false} style={styles.blockHint}>{report.relationship.title}</ThemedText>
                </View>
                {report.relationship.coefficient !== null ? (
                  <View style={styles.correlationBadge}>
                    <Text selectable style={styles.correlationText}>r {report.relationship.coefficient.toFixed(2).replace('.', ',')}</Text>
                  </View>
                ) : null}
              </View>
              <RelationshipPlot report={report} width={chartWidth} feedingLabel={t('meals')} diaperLabel={t('diaper')} sleepLabel={t('sleep')} theme={theme} />
              <ThemedText adaptive={false} style={styles.relationshipText}>{report.relationship.description}</ThemedText>
            </View>

            <View style={styles.methodNote}>
              <IconSymbol name="info.circle" size={13} color={theme.textTertiary} />
              <ThemedText adaptive={false} style={styles.methodText}>{t('method')}</ThemedText>
            </View>
          </>
        )}
      </GlassCard>
    </View>
  );
}

const createStyles = (theme: AnalyticsTheme) => StyleSheet.create({
  section: { gap: 14 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  headingIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderCurve: 'continuous',
    backgroundColor: theme.accentSurface,
  },
  headingText: { flex: 1, gap: 2 },
  headingTitle: { fontSize: 17, fontWeight: '800', color: theme.textPrimary },
  headingHint: { fontSize: 12.5, lineHeight: 17, color: theme.textTertiary },
  periodControl: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: theme.controlSurface },
  periodButton: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12, borderCurve: 'continuous' },
  periodButtonActive: {
    backgroundColor: theme.raisedSurface,
    boxShadow: theme.isDark ? '0 2px 8px rgba(0,0,0,0.30)' : '0 2px 8px rgba(74,58,51,0.10)',
  },
  periodText: { fontSize: 13, fontWeight: '700', color: theme.textTertiary },
  periodTextActive: { color: theme.accent },
  reportContent: { padding: 18, gap: 16 },
  reportHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  reportHeaderText: { flex: 1, gap: 3 },
  reportEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: theme.accent },
  reportTitle: { fontSize: 21, lineHeight: 26, fontWeight: '800', letterSpacing: -0.35, color: theme.textPrimary },
  rangeLabel: { fontSize: 11.5, color: theme.textTertiary },
  coverageBadge: { alignItems: 'center', minWidth: 62, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 14, backgroundColor: theme.accentSurface },
  coverageNumber: { fontSize: 18, fontWeight: '800', color: theme.accent, fontVariant: ['tabular-nums'] },
  coverageText: { fontSize: 9.5, fontWeight: '700', color: theme.textTertiary },
  loadingBlock: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 12.5, color: theme.textTertiary, textAlign: 'center' },
  emptyBlock: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 18 },
  emptyEmoji: { fontSize: 30 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: theme.textPrimary, textAlign: 'center' },
  emptyText: { fontSize: 12.5, lineHeight: 18, color: theme.textSecondary, textAlign: 'center' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  summaryCard: { flexBasis: '45%', flexGrow: 1, minWidth: 125, padding: 12, gap: 4, borderRadius: 17, borderCurve: 'continuous', backgroundColor: theme.raisedSurface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.controlBorder },
  summaryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryEmoji: { fontSize: 13 },
  summaryLabel: { fontSize: 11.5, fontWeight: '700', color: theme.textSecondary },
  summaryValue: { fontSize: 21, fontWeight: '800', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  summaryChange: { fontSize: 10.5, fontWeight: '700', color: theme.textSecondary },
  summarySample: { fontSize: 9.5, lineHeight: 13, color: theme.textTertiary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.divider },
  chartHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  blockTitle: { fontSize: 14.5, fontWeight: '800', color: theme.textPrimary },
  blockHint: { fontSize: 10.5, lineHeight: 14, color: theme.textTertiary, marginTop: 2 },
  metricControl: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metricButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.controlBorder, backgroundColor: theme.controlSurface },
  metricDot: { width: 7, height: 7, borderRadius: 4 },
  metricText: { fontSize: 11, fontWeight: '700', color: theme.textSecondary },
  insightBlock: { gap: 9, padding: 13, borderRadius: 17, borderCurve: 'continuous', backgroundColor: theme.accentSurface },
  insightTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  insightTitle: { fontSize: 12.5, fontWeight: '800', color: theme.accent },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  insightDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: theme.accentSoft, marginTop: 7 },
  insightText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: theme.textSecondary },
  relationshipBlock: { gap: 8, paddingTop: 2 },
  relationshipHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  correlationBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: theme.accentSurface },
  correlationText: { fontSize: 11, fontWeight: '800', color: theme.accent, fontVariant: ['tabular-nums'] },
  relationshipText: { fontSize: 12, lineHeight: 17, color: theme.textSecondary },
  methodNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingTop: 3 },
  methodText: { flex: 1, fontSize: 10.5, lineHeight: 15, color: theme.textTertiary },
});
