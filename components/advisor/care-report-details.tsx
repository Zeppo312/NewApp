import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useLocale } from '@/contexts/LocaleContext';
import type { CareAnalyticsInsight, CareAnalyticsReport } from '@/lib/advisor/careAnalytics';
import { translateCareAnalytics } from '@/lib/advisor/careAnalyticsTranslations';

export type CareReportColors = {
  isDark?: boolean;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentSurface: string;
  raisedSurface: string;
  divider: string;
};

function Pager({ page, size, total, onChange, colors }: { page: number; size: number; total: number; onChange: (page: number) => void; colors: CareReportColors }) {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof translateCareAnalytics>[1], params?: Record<string, string | number>) => translateCareAnalytics(locale, key, params);
  return (
    <View style={styles.pager}>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: page === 0 }} disabled={page === 0} onPress={() => onChange(page - 1)} style={[styles.smallButton, { opacity: page === 0 ? 0.4 : 1 }]}>
        <Text style={{ color: colors.accent }}>{t('back')}</Text>
      </TouchableOpacity>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>{t('page', { from: page * size + 1, to: Math.min((page + 1) * size, total), total })}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: (page + 1) * size >= total }} disabled={(page + 1) * size >= total} onPress={() => onChange(page + 1)} style={[styles.smallButton, { opacity: (page + 1) * size >= total ? 0.4 : 1 }]}>
        <Text style={{ color: colors.accent }}>{t('forward')}</Text>
      </TouchableOpacity>
    </View>
  );
}

export function CareDayCoverageList({ report, colors }: { report: CareAnalyticsReport; colors: CareReportColors }) {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof translateCareAnalytics>[1], params?: Record<string, string | number>) => translateCareAnalytics(locale, key, params);
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const days = [...report.dayCoverage].reverse();
  const size = expanded ? 7 : 3;
  return (
    <View style={[styles.block, { backgroundColor: colors.raisedSurface }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{t('coverage')}</Text>
      <Text selectable style={[styles.body, { color: colors.textSecondary }]}>{t('coverageCount', { count: report.coverageDays, total: report.totalDays })}</Text>
      <Text style={[styles.caption, { color: colors.textTertiary }]}>{t('coverageHint')}</Text>
      {days.slice(page * size, (page + 1) * size).map((day) => (
        <View key={day.key} style={[styles.day, { borderTopColor: colors.divider }]}>
          <View style={styles.dayHeading}>
            <Text selectable style={[styles.dayDate, { color: colors.textPrimary }]}>{day.label}</Text>
            <Text style={[styles.caption, { color: day.status === 'present' ? colors.textSecondary : colors.accent }]}>{t(day.status)}</Text>
          </View>
          {day.isToday ? <Text style={[styles.caption, { color: colors.accent }]}>{t('today')}</Text> : null}
          {day.openSleep ? <Text style={[styles.caption, { color: colors.accent }]}>{t('openSleep')}</Text> : null}
          {day.status !== 'missing' ? <Text selectable style={[styles.caption, { color: colors.textSecondary }]}>{t('dailyCounts', day.counts)}</Text> : null}
          {day.status === 'partial' ? <Text style={[styles.caption, { color: colors.textTertiary }]}>{t('missingAreas', { areas: day.missingMetrics.map((key) => t(key)).join(', ') })}</Text> : null}
        </View>
      ))}
      {expanded && days.length > size ? <Pager page={page} size={size} total={days.length} onChange={setPage} colors={colors} /> : null}
      {days.length > 3 ? (
        <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => { setExpanded(!expanded); setPage(0); }} style={styles.smallButton}>
          <Text style={[styles.link, { color: colors.accent }]}>{t(expanded ? 'fewerDays' : 'moreDays', { count: days.length })}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function CareObservationCard({ insight, colors }: { insight: CareAnalyticsInsight; colors: CareReportColors }) {
  const { locale, localeTag } = useLocale();
  const router = useRouter();
  const t = (key: Parameters<typeof translateCareAnalytics>[1], params?: Record<string, string | number>) => translateCareAnalytics(locale, key, params);
  const [source, setSource] = useState<'current' | 'previous' | 'pendingLabel'>(insight.entries.length ? 'current' : insight.pendingEntries.length ? 'pendingLabel' : 'current');
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const entries = source === 'previous' ? insight.previousEntries : source === 'pendingLabel' ? insight.pendingEntries : insight.entries;
  const size = expanded ? 5 : 3;
  const stamp = (value: string) => new Date(value).toLocaleString(localeTag, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[styles.block, { backgroundColor: colors.accentSurface }]}>
      <Text style={[styles.eyebrow, { color: colors.accent }]}>{t('observation')} · {t(insight.key)}</Text>
      <Text selectable style={[styles.body, { color: colors.textPrimary }]}>{insight.observation}</Text>
      <View style={[styles.evidence, { borderTopColor: colors.divider }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('basis')}</Text>
        <Text selectable style={[styles.caption, { color: colors.textSecondary }]}>{t('current')}: {insight.evidence}</Text>
        <Text selectable style={[styles.caption, { color: colors.textSecondary }]}>{t('previous')}: {insight.previousEvidence}</Text>
        {insight.pendingEntries.length ? <Text style={[styles.caption, { color: colors.textSecondary }]}>{t('pending', { count: insight.pendingEntries.length })}</Text> : null}
        <View style={styles.sources}>
          {(['current', 'previous', ...(insight.pendingEntries.length ? ['pendingLabel'] : [])] as ('current' | 'previous' | 'pendingLabel')[]).map((key) => (
            <TouchableOpacity key={key} accessibilityRole="button" accessibilityState={{ selected: source === key }} onPress={() => { setSource(key); setExpanded(false); setPage(0); }} style={[styles.sourceButton, source === key && { backgroundColor: colors.raisedSurface }]}>
              <Text style={[styles.caption, { color: source === key ? colors.accent : colors.textSecondary }]}>{t(key === 'current' ? 'sourceCurrent' : key === 'previous' ? 'sourcePrevious' : 'sourcePending')}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {entries.slice(page * size, (page + 1) * size).map((entry) => (
          <View key={entry.key} style={[styles.entry, { borderTopColor: colors.divider }]}>
            <Text selectable style={[styles.caption, { color: colors.textPrimary }]}>{stamp(entry.startTime)} · {entry.label}</Text>
            {entry.minutes !== null ? <Text selectable style={[styles.caption, { color: colors.textSecondary }]}>{entry.ongoing ? t('ongoing') : entry.endTime ? `→ ${stamp(entry.endTime)}` : ''} · {t('contribution', { minutes: Math.round(entry.minutes) })}</Text> : null}
          </View>
        ))}
        {expanded && entries.length > size ? <Pager page={page} size={size} total={entries.length} onChange={setPage} colors={colors} /> : null}
        {entries.length > 3 ? <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => { setExpanded(!expanded); setPage(0); }} style={styles.smallButton}>
          <Text style={[styles.link, { color: colors.accent }]}>{t(expanded ? 'fewerEntries' : 'moreEntries', { count: entries.length })}</Text>
        </TouchableOpacity> : null}
      </View>
      <View style={[styles.evidence, { borderTopColor: colors.divider }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{t('next')}</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>{insight.action}</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push(insight.key === 'sleep' ? '/(tabs)/sleep-tracker' : '/(tabs)/daily_old')} style={[styles.action, { backgroundColor: colors.accent }]}>
          <Text style={[styles.actionText, { color: colors.isDark ? '#261B40' : '#FFFFFF' }]}>{t(insight.key === 'sleep' ? 'sleepAction' : 'dailyAction')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 9, padding: 14, borderRadius: 18, borderCurve: 'continuous' },
  title: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  eyebrow: { fontSize: 13, lineHeight: 18, fontWeight: '800' },
  body: { fontSize: 13, lineHeight: 19 },
  caption: { fontSize: 12, lineHeight: 17 },
  day: { gap: 3, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth },
  dayHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 6 },
  dayDate: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  evidence: { gap: 7, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth },
  sources: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  sourceButton: { padding: 9, minHeight: 44, justifyContent: 'center', borderRadius: 10 },
  entry: { gap: 2, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  pager: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  smallButton: { minHeight: 44, justifyContent: 'center', paddingVertical: 9, paddingHorizontal: 4 },
  link: { fontSize: 12, lineHeight: 17, fontWeight: '700' },
  action: { padding: 12, minHeight: 44, alignItems: 'center', borderRadius: 12, borderCurve: 'continuous' },
  actionText: { color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
});
