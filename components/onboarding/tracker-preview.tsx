import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import ActivityCard from '@/components/ActivityCard';
import { SleepTimerFace } from '@/components/tracking/SleepTimerFace';
import { DailyQuickAction } from '@/components/tracking/DailyQuickAction';
import type { DailyEntry } from '@/lib/baby';
import { translateDailyText } from '@/lib/dailyTranslations';
import { translateSleepTrackerText } from '@/lib/sleepTrackerTranslations';
import type { OnboardingLocale } from '@/lib/onboardingTranslations';
import { onboardingColors as brand } from './theme';

const ignoreDelete = () => {};
export function exampleCareEntry(kind: 'daily' | 'sleep', date = new Date()): DailyEntry {
  const time = (hours: number, minutes: number) => { const d = new Date(date); d.setHours(hours, minutes, 0, 0); return d.toISOString(); };
  return kind === 'sleep'
    ? { id: 'onboarding-sleep', entry_type: 'sleep', entry_date: time(9, 5), start_time: time(9, 5), end_time: time(9, 50) }
    : { id: 'onboarding-meal', entry_type: 'feeding', feeding_type: 'BOTTLE', feeding_volume_ml: 120, entry_date: time(8, 10), start_time: time(8, 10) };
}
export function TrackerPreview({ kind, locale, compact = false }: { kind: 'daily' | 'sleep'; locale: OnboardingLocale; compact?: boolean }) {
  const { width, fontScale } = useWindowDimensions();
  // Fixed-size decorative controls give way to readable activity cards at larger text sizes.
  const showControls = !compact && (fontScale ?? 1) < 1.5;
  return <View style={styles.preview}>
    {!compact && <Text style={styles.title}>{kind === 'daily' ? translateDailyText(locale, 'screen.title') : translateSleepTrackerText(locale, 'screen.title')}</Text>}
    {kind === 'sleep' && showControls && <View style={styles.clock}><SleepTimerFace size={Math.min(238, width - 88)} active progress={45 / 480 * 100} timeLabel="00:45:00" textColor={brand.text}><Text style={styles.status}>{translateDailyText(locale, 'card.sleep')}</Text><Text style={styles.hint}>09:05 – 09:50</Text></SleepTimerFace></View>}
    {kind === 'daily' && showControls && <View style={styles.actions}>
      <DailyQuickAction emoji="🍼" label={translateDailyText(locale, 'card.bottle')} textColor={brand.secondary} disabled />
      <DailyQuickAction emoji="💧" label={translateDailyText(locale, 'diaper.wet')} textColor={brand.secondary} disabled />
    </View>}
    <ActivityCard entry={exampleCareEntry(kind)} onDelete={ignoreDelete} readOnly appearance="light" marginHorizontal={0} />
    {kind === 'daily' && !compact && <ActivityCard entry={exampleCareEntry('sleep')} onDelete={ignoreDelete} readOnly appearance="light" marginHorizontal={0} />}
  </View>;
}
export function PreviewActivity({ entry }: { entry: DailyEntry }) {
  return <ActivityCard entry={entry} onDelete={ignoreDelete} readOnly appearance="light" marginHorizontal={0} />;
}
const styles = StyleSheet.create({
  preview: { gap: 8 }, title: { color: brand.text, fontSize: 22, lineHeight: 29, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  clock: { alignItems: 'center', paddingBottom: 8 }, status: { fontSize: 16, fontWeight: '700', color: brand.text }, hint: { fontSize: 12, color: brand.secondary, marginTop: 3 },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 12 },
});
