import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { getOnboardingPregnancyProgress } from '@/lib/onboarding-flow';
import type { OnboardingNeed, OnboardingChallenge, OnboardingSupport, OnboardingHabit } from '@/lib/onboarding-personalization';
import { translateOnboardingText, type OnboardingLocale } from '@/lib/onboardingTranslations';
import { OnboardingChoice, OnboardingSurface } from './surfaces';
import { onboardingColors as brand } from './theme';
import { valueCopy } from './value-copy';
import { TrackerPreview } from './tracker-preview';

const icons = { sleep: 'moon.fill', daily: 'sun.max.fill', overview: 'heart.fill', checklist: 'checklist', memories: 'book.fill' } as const;
const names = { sleep: 'Sleep', daily: 'Daily', overview: 'Overview', checklist: 'Checklist', memories: 'Memories' } as const;
type PreviewProps = { locale: OnboardingLocale; need: OnboardingNeed; dueDate?: Date | null; babyName?: string; compact?: boolean };

/** Illustrative entries stay local to this view and never become baby records. */
export function ProductPreview({ locale, need, dueDate, babyName, compact = false }: PreviewProps) {
  const c = valueCopy(locale);
  const pregnancy = getOnboardingPregnancyProgress(dueDate ?? null);
  if (need === 'daily' || need === 'sleep') return <View style={s.preview}><TrackerPreview kind={need} locale={locale} compact={compact} /></View>;
  return <View style={s.preview}>
    
    <OnboardingSurface tone={brand.softAccent} style={s.product}>
      <View style={s.row}><View style={s.icon}><IconSymbol name={icons[need]} size={24} color={brand.accentText} /></View><Text style={s.cardTitle}>{need === 'overview' ? c.week : need === 'checklist' ? c.checklist : need === 'memories' ? c.memory : c.today}</Text></View>
      {!!babyName?.trim() && <Text style={s.baby}>{babyName.trim()}</Text>}
      {need === 'overview' ? <>
        <View style={compact ? s.weekCompact : s.weekDisc}><IconSymbol name="heart.fill" size={30} color={brand.accent} /><Text style={s.weekNumber}>{pregnancy?.week ?? '—'}</Text><Text style={s.body}>{c.weekUnit}</Text></View>
        <Text style={s.centered}>{pregnancy ? translateOnboardingText(locale, 'moment.weekDetail', { weeks: pregnancy.completedWeeks, days: pregnancy.day }) : c.weekFallback}</Text>
      </> : need === 'checklist' ? <>
        {[c.task1, c.task2, c.task3].map((task, i) => <View key={task} style={s.entry}><IconSymbol name={i === 0 ? 'checkmark.circle.fill' : 'circle'} size={24} color={i === 0 ? brand.accent : brand.muted} /><Text style={[s.entryText, i === 0 && s.completed]}>{task}</Text></View>)}
        <View style={s.track}><View style={[s.fill, { width: '33.333%' }]} /></View><Text style={s.caption}>{c.taskCount}</Text>
      </> : need === 'memories' ? <View style={s.memory}><IconSymbol name="heart.fill" size={30} color={brand.accent} /><Text style={s.story}>{c.memoryText}</Text></View> : null}
    </OnboardingSurface>
    {!compact && <View style={s.proof}><IconSymbol name="checkmark.circle.fill" size={20} color={brand.accentText} /><Text style={s.proofText}>{c.saved}</Text></View>}
  </View>;
}

export function ValueStep({ kind, locale, need, dueDate, babyName, challenge = 'remember', support = 'solo' }: PreviewProps & { kind: 'welcome' | 'personalValue' | 'relief' | 'sharedValue'; challenge?: OnboardingChallenge; support?: OnboardingSupport }) {
  const c = valueCopy(locale);
  const title = kind === 'welcome' ? c.welcomeTitle : kind === 'relief' ? c.reliefTitle : kind === 'sharedValue' ? c[`${support}Title`] : c[`${need}Title`];
  const body = kind === 'welcome' ? c.welcomeBody : kind === 'relief' ? c.reliefBody : kind === 'sharedValue' ? c[`${support}Body`] : c[`${need}Body`];
  return <View style={s.screen}>
    <Text accessibilityRole="header" style={s.title}>{title}</Text>
    <Text style={s.body}>{body}</Text>
    <View style={s.visualArea}>
      {kind === 'relief' && <View style={s.thought}><Text style={s.caption}>{c.before}</Text><Text style={s.quote}>{c[challenge]}</Text><IconSymbol name="arrow.down" size={23} color={brand.accent} /></View>}
      {kind === 'sharedValue' && support === 'together' && <View style={s.people}>
        {[c.you, c.partner].map(person => <View style={s.person} key={person}><View style={s.avatar}><IconSymbol name="person.fill" size={28} color={brand.accentText} /></View><Text style={s.caption}>{person}</Text></View>)}
      </View>}
      <ProductPreview compact={kind === 'relief' || kind === 'sharedValue'} locale={locale} need={kind === 'welcome' ? 'daily' : need} dueDate={dueDate} babyName={babyName} />
      {kind === 'sharedValue' && support === 'together' && <Text style={s.centered}>{c.linkNote}</Text>}
    </View>
  </View>;
}

export function FeedbackStep({ locale, helpful, onHelpful, onChooseAnother }: { locale: OnboardingLocale; helpful: boolean; onHelpful: () => void; onChooseAnother: () => void }) {
  const c = valueCopy(locale);
  return <View style={s.screen}><Text accessibilityRole="header" style={s.title}>{c.feedbackTitle}</Text><Text style={s.body}>{c.feedbackBody}</Text><View style={s.visualArea}>
    <OnboardingChoice selected={helpful} accessibilityLabel={c.yes} onPress={onHelpful} contentStyle={s.choice}><IconSymbol name="checkmark.circle.fill" size={24} color={brand.accentText} /><Text style={s.choiceText}>{c.yes}</Text></OnboardingChoice>
    <OnboardingChoice accessibilityLabel={c.other} onPress={onChooseAnother} contentStyle={s.choice}><IconSymbol name="arrow.left" size={24} color={brand.accentText} /><Text style={s.choiceText}>{c.other}</Text></OnboardingChoice>
  </View></View>;
}

export function HabitStep({ locale, need, habit, onSelect }: { locale: OnboardingLocale; need: OnboardingNeed; habit: OnboardingHabit | null; onSelect: (value: OnboardingHabit) => void }) {
  const c = valueCopy(locale);
  const t = (choice: OnboardingHabit) => translateOnboardingText(locale, `survey.habit${names[need]}${choice === 'in_moment' ? 'Now' : 'Quiet'}`);
  return <View style={s.screen}><Text accessibilityRole="header" style={s.title}>{c.habitTitle}</Text><Text style={s.body}>{translateOnboardingText(locale, 'survey.habitBody')}</Text><View style={s.visualArea}>
    {(['in_moment', 'quiet_moment'] as const).map(choice => <OnboardingChoice key={choice} selected={habit === choice} accessibilityLabel={t(choice)} onPress={() => onSelect(choice)} contentStyle={s.choice}><IconSymbol name={choice === 'in_moment' ? 'sun.max.fill' : 'moon.fill'} size={26} color={brand.accentText} /><Text style={s.choiceText}>{t(choice)}</Text><IconSymbol name={habit === choice ? 'checkmark.circle.fill' : 'circle'} size={22} color={brand.accentText} /></OnboardingChoice>)}
    <Text style={s.caption}>{translateOnboardingText(locale, 'survey.habitNote')}</Text>
  </View></View>;
}

export const valueStyles = StyleSheet.create({
  screen: { flexGrow: 1, flexShrink: 0, gap: 16, paddingTop: 14, paddingBottom: 12 },
  title: { fontSize: 34, lineHeight: 41, letterSpacing: -0.9, fontWeight: '700', color: brand.text },
  body: { fontSize: 17, lineHeight: 25, color: brand.secondary },
});
const s = StyleSheet.create({
  ...valueStyles,
  visualArea: { flexGrow: 1, flexShrink: 0, justifyContent: 'center', gap: 20, paddingVertical: 16 },
  preview: { gap: 12 }, caption: { fontSize: 12, lineHeight: 18, color: brand.secondary },
  product: { padding: 22, gap: 20 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 16, borderCurve: 'continuous', borderWidth: 1, borderColor: 'rgba(255,255,255,0.72)', backgroundColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { flex: 1, fontSize: 21, lineHeight: 27, fontWeight: '700', color: brand.text }, baby: { color: brand.accentText, fontSize: 17, fontWeight: '600' },
  timeline: { gap: 16, position: 'relative' }, timelineLine: { position: 'absolute', left: 64, top: 16, bottom: 30, width: 2, backgroundColor: brand.selected },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 }, time: { width: 44, paddingTop: 15, color: brand.secondary, fontSize: 13, fontVariant: ['tabular-nums'] }, dot: { width: 14, height: 14, marginTop: 17, borderRadius: 7, backgroundColor: brand.accent, borderWidth: 3, borderColor: brand.selected },
  event: { flex: 1, padding: 15, borderRadius: 19, gap: 6, backgroundColor: 'rgba(255,255,255,.75)' }, entryText: { flexShrink: 1, fontSize: 16, lineHeight: 22, fontWeight: '600', color: brand.text },
  proof: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, proofText: { color: brand.accentText, fontSize: 14, flexShrink: 1 },
  entry: { flexDirection: 'row', gap: 12, alignItems: 'center' }, completed: { textDecorationLine: 'line-through', color: brand.muted },
  track: { height: 6, borderRadius: 3, backgroundColor: brand.selected, overflow: 'hidden' }, fill: { height: '100%', backgroundColor: brand.accent },
  memory: { gap: 18, padding: 20, backgroundColor: 'rgba(255,255,255,0.24)', borderColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderRadius: 20, borderCurve: 'continuous' }, story: { fontSize: 22, lineHeight: 32, color: brand.text },
  weekCompact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }, weekDisc: { alignSelf: 'center', width: 180, height: 180, borderRadius: 90, borderWidth: 12, borderColor: brand.selected, alignItems: 'center', justifyContent: 'center' }, weekNumber: { fontSize: 52, fontWeight: '700', color: brand.text }, centered: { fontSize: 13, lineHeight: 20, color: brand.secondary, textAlign: 'center' },
  thought: { alignItems: 'center', gap: 10 }, quote: { color: brand.text, fontSize: 22, lineHeight: 29, textAlign: 'center' }, people: { flexDirection: 'row', justifyContent: 'space-evenly', gap: 16 }, person: { alignItems: 'center', gap: 8 }, avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: brand.selectedGlass, justifyContent: 'center', alignItems: 'center' },
  choice: { flexDirection: 'row', gap: 14, padding: 22, minHeight: 88, alignItems: 'center' }, choiceText: { flex: 1, fontSize: 17, lineHeight: 25, fontWeight: '600', color: brand.text },
});
