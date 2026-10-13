import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import type { OnboardingSupport, OnboardingHabit, OnboardingWellbeing } from '@/lib/onboarding-personalization';
import { type OnboardingStart } from '@/lib/onboarding-flow';
import { translateOnboardingText, type OnboardingLocale } from '@/lib/onboardingTranslations';
import { OnboardingSurface } from './surfaces';
import { onboardingColors as brand } from './theme';
import { wellbeingCopy, wellbeingSummary } from './wellbeing-step';
import { valueCopy } from './value-copy';
import { valueStyles } from './value-steps';

type Props = {
  locale: OnboardingLocale; isBabyBorn: boolean; isPartner: boolean;
  babyName?: string; partnerName?: string; dueDate: Date | null; now?: Date;
  selectedStart: OnboardingStart; support: OnboardingSupport; habit?: OnboardingHabit | null; wellbeing?: OnboardingWellbeing;
};

/** Summarizes the selected destination before the existing access flow. */
export function OnboardingProductMoment({ locale, isPartner, babyName, partnerName, selectedStart, support, habit, wellbeing }: Props) {
  const c = valueCopy(locale);
  const names = { sleep: 'Sleep', daily: 'Daily', overview: 'Overview', checklist: 'Checklist', memories: 'Memories' } as const;
  return <View style={styles.screen}>
    <View style={styles.ready}><IconSymbol name="checkmark.circle.fill" size={28} color={brand.accentText} /><Text style={styles.readyText}>{babyName?.trim() ? translateOnboardingText(locale, 'flow.forBaby', { name: babyName.trim() }) : translateOnboardingText(locale, 'flow.forFamily')}</Text></View>
    <Text accessibilityRole="header" style={styles.title}>{c.planTitle}</Text>
    <Text style={styles.body}>{c.planBody}</Text>
    <OnboardingSurface tone={brand.softAccent} style={styles.next}>
      <Text style={styles.label}>{c.next}</Text><Text style={styles.action}>{c[`next${names[selectedStart]}`]}</Text>
      {habit && <Text style={styles.detail}>{translateOnboardingText(locale, `survey.habit${names[selectedStart]}${habit === 'in_moment' ? 'Now' : 'Quiet'}`)}</Text>}
    </OnboardingSurface>
    {wellbeing && (wellbeing.mood !== null || wellbeing.energy !== null) && <OnboardingSurface style={styles.next}><Text style={styles.action}>{wellbeingCopy(locale).summaryTitle}</Text><Text style={styles.detail}>{wellbeingSummary(locale, wellbeing)}</Text></OnboardingSurface>}
    <Text style={styles.detail}>{isPartner && partnerName && support === 'together' ? translateOnboardingText(locale, 'flow.linked', { name: partnerName }) : support === 'together' ? c.linkNote : support === 'solo' ? translateOnboardingText(locale, 'survey.supportSolo') : c.laterBody}</Text>
  </View>;
}
const styles = StyleSheet.create({
  ...valueStyles,
  ready: { flexDirection: 'row', alignItems: 'center', gap: 10 }, readyText: { flex: 1, color: brand.accentText, fontSize: 16, fontWeight: '600' },
  next: { padding: 20, gap: 9 }, label: { color: brand.accentText, fontSize: 12, fontWeight: '700' }, action: { color: brand.text, fontSize: 18, lineHeight: 26, fontWeight: '600' }, detail: { color: brand.secondary, fontSize: 13, lineHeight: 20 },
});
