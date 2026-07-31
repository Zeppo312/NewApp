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

const PURPLE = '#5E3DB3';
const PURPLE_SOFT = '#8E4EC6';
const PINK = '#C96892';
const TEAL = '#3F9D91';
const TEXT_PRIMARY = '#4A3A33';
const TEXT_SECONDARY = '#7D5A50';
const TEXT_TERTIARY = '#9C8178';
const GRID = 'rgba(74,58,51,0.12)';

const TILE_PROPS = {
  frostColor: 'rgba(255,255,255,0.55)',
  borderColor: 'rgba(255,255,255,0.9)',
  innerBorderColor: 'rgba(255,255,255,0.5)',
  highlightStrength: 'strong' as const,
  glossOpacity: 0.5,
  grainOpacity: 0.04,
  shadeOpacity: 0.5,
};

const PERIODS: { key: CareAnalyticsPeriod; label: string }[] = [
  { key: 'week', label: 'Woche' },
  { key: 'month', label: 'Monat' },
  { key: 'year', label: 'Jahr' },
];

const METRICS: { key: CareMetricKey; label: string; color: string }[] = [
  { key: 'sleep', label: 'Schlaf', color: PURPLE },
  { key: 'feeding', label: 'Mahlzeiten', color: PINK },
  { key: 'diaper', label: 'Windeln', color: TEAL },
];

const metricColor = (key: CareMetricKey) =>
  METRICS.find((metric) => metric.key === key)?.color ?? PURPLE;

const formatValue = (metric: CareMetricKey, value: number | null) => {
  if (value === null) return '–';
  if (metric === 'sleep') {
    const minutes = Math.round(value);
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours > 0 ? `${hours}h ${String(rest).padStart(2, '0')}m` : `${rest} Min`;
  }
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
};

const changeText = (value: number | null) => {
  if (value === null) return 'Vergleich lernt noch';
  const rounded = Math.round(Math.abs(value));
  if (rounded < 3) return 'nahezu stabil';
  return `${value >= 0 ? '↑' : '↓'} ${rounded} % zum Vergleich`;
};

const pointValue = (point: CareTrendPoint, metric: CareMetricKey) => point[metric];

function TrendChart({
  report,
  metric,
  width,
}: {
  report: CareAnalyticsReport;
  metric: CareMetricKey;
  width: number;
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
    <View accessibilityLabel={`${METRICS.find((item) => item.key === metric)?.label}-Verlauf`}>
      <Svg width={width} height={height}>
        {[0, 0.5, 1].map((fraction) => {
          const y = top + plotHeight * fraction;
          return <Line key={fraction} x1={0} x2={width} y1={y} y2={y} stroke={GRID} strokeWidth={1} />;
        })}
        {previousPath ? (
          <Path
            d={previousPath}
            fill="none"
            stroke="rgba(74,58,51,0.30)"
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
            stroke={metricColor(metric)}
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
              fill="#FFFFFF"
              stroke={metricColor(metric)}
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
              fill={TEXT_TERTIARY}
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

function RelationshipPlot({ report, width }: { report: CareAnalyticsReport; width: number }) {
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
      <Line x1={inset} x2={inset} y1={inset} y2={height - 22} stroke={GRID} strokeWidth={1} />
      <Line x1={inset} x2={width - inset} y1={height - 22} y2={height - 22} stroke={GRID} strokeWidth={1} />
      {sampled.map((point) => (
        <Circle
          key={point.key}
          cx={inset + (point.x / maxX) * (width - inset * 2)}
          cy={inset + (1 - point.y / maxY) * (height - 34)}
          r={4}
          fill="rgba(94,61,179,0.24)"
          stroke={PURPLE}
          strokeWidth={1.2}
        />
      ))}
      <SvgText x={inset} y={height - 5} fontSize={9.5} fill={TEXT_TERTIARY}>
        {relationship.x === 'feeding' ? 'Mahlzeiten →' : 'Windeln →'}
      </SvgText>
      <SvgText x={width - inset} y={13} fontSize={9.5} fill={TEXT_TERTIARY} textAnchor="end">
        {relationship.y === 'sleep' ? 'Schlaf ↑' : 'Windeln ↑'}
      </SvgText>
    </Svg>
  );
}

export function CareAnalyticsSection({ babyId }: { babyId?: string | null }) {
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
    () => buildCareAnalyticsReport({ period, careEntries, sleepEntries }),
    [careEntries, period, sleepEntries],
  );

  const select = (callback: () => void) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    callback();
  };

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingIcon}>
          <IconSymbol name="chart.line.uptrend.xyaxis" size={18} color={PURPLE} />
        </View>
        <View style={styles.headingText}>
          <ThemedText adaptive={false} style={styles.headingTitle}>Rhythmus & Berichte</ThemedText>
          <ThemedText adaptive={false} style={styles.headingHint}>Zeiträume vergleichen und Muster gemeinsam betrachten</ThemedText>
        </View>
      </View>

      <View style={styles.periodControl}>
        {PERIODS.map((item) => {
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

      <GlassCard {...TILE_PROPS} radius={26} contentStyle={styles.reportContent}>
        <View style={styles.reportHeader}>
          <View style={styles.reportHeaderText}>
            <ThemedText adaptive={false} style={styles.reportEyebrow}>{report.title}</ThemedText>
            <ThemedText adaptive={false} style={styles.reportTitle}>{report.headline}</ThemedText>
            <ThemedText adaptive={false} style={styles.rangeLabel}>{report.rangeLabel}</ThemedText>
          </View>
          <View style={styles.coverageBadge}>
            <Text style={styles.coverageNumber}>{report.coverageDays}</Text>
            <Text style={styles.coverageText}>/{report.totalDays} Tage</Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator color={PURPLE} />
            <ThemedText adaptive={false} style={styles.loadingText}>Bericht wird aus euren Einträgen aufgebaut …</ThemedText>
          </View>
        ) : loadFailed ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyEmoji}>☁️</Text>
            <ThemedText adaptive={false} style={styles.emptyTitle}>Daten gerade nicht erreichbar</ThemedText>
            <ThemedText adaptive={false} style={styles.emptyText}>Der Tagesbereich funktioniert weiter. Der Bericht versucht es beim nächsten Öffnen erneut.</ThemedText>
          </View>
        ) : !report.hasData ? (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <ThemedText adaptive={false} style={styles.emptyTitle}>Der Bericht wächst mit euren Einträgen</ThemedText>
            <ThemedText adaptive={false} style={styles.emptyText}>Sobald Schlaf, Mahlzeiten oder Windeln erfasst sind, erscheinen hier Vergleiche und Kurven.</ThemedText>
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
                  <Text selectable style={[styles.summaryValue, { color: metricColor(summary.key) }]}>
                    {formatValue(summary.key, summary.value)}
                  </Text>
                  <Text style={styles.summaryChange}>{changeText(summary.changePercent)}</Text>
                  <Text style={styles.summarySample}>Ø aus {summary.recordedDays} erfassten Tagen</Text>
                </View>
              ))}
            </View>

            <View style={styles.divider} />

            <View style={styles.chartHeader}>
              <View>
                <ThemedText adaptive={false} style={styles.blockTitle}>Verlauf</ThemedText>
                <ThemedText adaptive={false} style={styles.blockHint}>Durchgezogen aktuell · gestrichelt {report.comparisonLabel}</ThemedText>
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
                    style={[styles.metricButton, active && { backgroundColor: `${item.color}18`, borderColor: `${item.color}44` }]}
                  >
                    <View style={[styles.metricDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.metricText, active && { color: item.color }]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TrendChart report={report} metric={metric} width={chartWidth} />

            <View style={styles.insightBlock}>
              <View style={styles.insightTitleRow}>
                <IconSymbol name="sparkles" size={14} color={PURPLE} />
                <ThemedText adaptive={false} style={styles.insightTitle}>Was auffällt</ThemedText>
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
                  <ThemedText adaptive={false} style={styles.blockTitle}>Zusammen betrachtet</ThemedText>
                  <ThemedText adaptive={false} style={styles.blockHint}>{report.relationship.title}</ThemedText>
                </View>
                {report.relationship.coefficient !== null ? (
                  <View style={styles.correlationBadge}>
                    <Text selectable style={styles.correlationText}>r {report.relationship.coefficient.toFixed(2).replace('.', ',')}</Text>
                  </View>
                ) : null}
              </View>
              <RelationshipPlot report={report} width={chartWidth} />
              <ThemedText adaptive={false} style={styles.relationshipText}>{report.relationship.description}</ThemedText>
            </View>

            <View style={styles.methodNote}>
              <IconSymbol name="info.circle" size={13} color={TEXT_TERTIARY} />
              <ThemedText adaptive={false} style={styles.methodText}>Durchschnitte beziehen sich auf Tage mit einem passenden Eintrag. Zusammenhänge zeigen gemeinsame Bewegungen, keine medizinische Bewertung oder Ursache.</ThemedText>
            </View>
          </>
        )}
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  headingIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(94,61,179,0.10)',
  },
  headingText: { flex: 1, gap: 2 },
  headingTitle: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY },
  headingHint: { fontSize: 12.5, lineHeight: 17, color: TEXT_TERTIARY },
  periodControl: { flexDirection: 'row', padding: 4, borderRadius: 16, backgroundColor: 'rgba(94,61,179,0.09)' },
  periodButton: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12, borderCurve: 'continuous' },
  periodButtonActive: { backgroundColor: '#FFFFFF', boxShadow: '0 2px 8px rgba(74,58,51,0.10)' },
  periodText: { fontSize: 13, fontWeight: '700', color: TEXT_TERTIARY },
  periodTextActive: { color: PURPLE },
  reportContent: { padding: 18, gap: 16 },
  reportHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  reportHeaderText: { flex: 1, gap: 3 },
  reportEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: PURPLE },
  reportTitle: { fontSize: 21, lineHeight: 26, fontWeight: '800', letterSpacing: -0.35, color: TEXT_PRIMARY },
  rangeLabel: { fontSize: 11.5, color: TEXT_TERTIARY },
  coverageBadge: { alignItems: 'center', minWidth: 62, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(94,61,179,0.09)' },
  coverageNumber: { fontSize: 18, fontWeight: '800', color: PURPLE, fontVariant: ['tabular-nums'] },
  coverageText: { fontSize: 9.5, fontWeight: '700', color: TEXT_TERTIARY },
  loadingBlock: { minHeight: 170, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 12.5, color: TEXT_TERTIARY, textAlign: 'center' },
  emptyBlock: { minHeight: 180, alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 18 },
  emptyEmoji: { fontSize: 30 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'center' },
  emptyText: { fontSize: 12.5, lineHeight: 18, color: TEXT_SECONDARY, textAlign: 'center' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  summaryCard: { flexBasis: '45%', flexGrow: 1, minWidth: 125, padding: 12, gap: 4, borderRadius: 17, borderCurve: 'continuous', backgroundColor: 'rgba(255,255,255,0.58)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(74,58,51,0.10)' },
  summaryLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  summaryEmoji: { fontSize: 13 },
  summaryLabel: { fontSize: 11.5, fontWeight: '700', color: TEXT_SECONDARY },
  summaryValue: { fontSize: 21, fontWeight: '800', letterSpacing: -0.3, fontVariant: ['tabular-nums'] },
  summaryChange: { fontSize: 10.5, fontWeight: '700', color: TEXT_SECONDARY },
  summarySample: { fontSize: 9.5, lineHeight: 13, color: TEXT_TERTIARY },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: GRID },
  chartHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  blockTitle: { fontSize: 14.5, fontWeight: '800', color: TEXT_PRIMARY },
  blockHint: { fontSize: 10.5, lineHeight: 14, color: TEXT_TERTIARY, marginTop: 2 },
  metricControl: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  metricButton: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(74,58,51,0.12)', backgroundColor: 'rgba(255,255,255,0.46)' },
  metricDot: { width: 7, height: 7, borderRadius: 4 },
  metricText: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY },
  insightBlock: { gap: 9, padding: 13, borderRadius: 17, borderCurve: 'continuous', backgroundColor: 'rgba(94,61,179,0.075)' },
  insightTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  insightTitle: { fontSize: 12.5, fontWeight: '800', color: PURPLE },
  insightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  insightDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: PURPLE_SOFT, marginTop: 7 },
  insightText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: TEXT_SECONDARY },
  relationshipBlock: { gap: 8, paddingTop: 2 },
  relationshipHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  correlationBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(94,61,179,0.10)' },
  correlationText: { fontSize: 11, fontWeight: '800', color: PURPLE, fontVariant: ['tabular-nums'] },
  relationshipText: { fontSize: 12, lineHeight: 17, color: TEXT_SECONDARY },
  methodNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, paddingTop: 3 },
  methodText: { flex: 1, fontSize: 10.5, lineHeight: 15, color: TEXT_TERTIARY },
});
