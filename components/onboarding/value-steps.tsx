import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { getOnboardingPregnancyProgress } from '@/lib/onboarding-flow';
import type { OnboardingNeed, OnboardingChallenge, OnboardingSupport, OnboardingHabit } from '@/lib/onboarding-personalization';
import { translateOnboardingText, type OnboardingLocale } from '@/lib/onboardingTranslations';
import { OnboardingChoice, OnboardingSurface } from './surfaces';
import { onboardingColors as brand } from './theme';
import { valueCopy } from './value-copy';
import { TrackerPreview } from './tracker-preview';
import { LottiMedallion } from './lotti-medallion';

const icons = { sleep: 'moon.fill', daily: 'sun.max.fill', overview: 'heart.fill', checklist: 'checklist', memories: 'book.fill' } as const;
/** The same arc the pregnancy home uses: the disc fills with the pregnancy instead of staying empty. */
function WeekRing({ progress, children }: { progress: number; children: React.ReactNode }) {
  const size = 180, stroke = 10, r = (size - stroke) / 2, circumference = 2 * Math.PI * r;
  return <View style={s.weekDisc}>
    <Svg width={size} height={size} style={s.ring}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={brand.selected} strokeWidth={stroke} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={brand.accent} strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - Math.min(1, Math.max(0, progress)))}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </Svg>
    {children}
  </View>;
}
const names = { sleep: 'Sleep', daily: 'Daily', overview: 'Overview', checklist: 'Checklist', memories: 'Memories' } as const;
type PreviewProps = { locale: OnboardingLocale; need: OnboardingNeed; dueDate?: Date | null; babyName?: string; compact?: boolean; cardsOnly?: boolean };

/** Illustrative entries stay local to this view and never become baby records. */
export function ProductPreview({ locale, need, dueDate, babyName, compact = false, cardsOnly = false }: PreviewProps) {
  const c = valueCopy(locale);
  const pregnancy = getOnboardingPregnancyProgress(dueDate ?? null);
  if (need === 'daily' || need === 'sleep') return <View style={s.preview}><TrackerPreview kind={need} locale={locale} compact={compact} cardsOnly={cardsOnly} /></View>;
  return <View style={s.preview}>
    
    <OnboardingSurface tone={brand.softAccent} style={s.product}>
      <View style={s.row}><View style={s.icon}><IconSymbol name={icons[need]} size={24} color={brand.accentText} /></View><Text style={s.cardTitle}>{need === 'overview' ? c.week : need === 'checklist' ? c.checklist : need === 'memories' ? c.memory : c.today}</Text></View>
      {!!babyName?.trim() && <Text style={s.baby}>{babyName.trim()}</Text>}
      {need === 'overview' ? <>
        {compact
          ? <View style={s.weekCompact}><IconSymbol name="heart.fill" size={30} color={brand.accent} /><Text style={s.weekNumber}>{pregnancy?.week ?? '—'}</Text><Text style={s.body}>{c.weekUnit}</Text></View>
          : <WeekRing progress={pregnancy?.progress ?? 0}><IconSymbol name="heart.fill" size={26} color={brand.accent} /><Text style={s.weekNumber}>{pregnancy?.week ?? '—'}</Text><Text style={s.body}>{c.weekUnit}</Text></WeekRing>}
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
    {kind === 'welcome' && <LottiMedallion pose="waving" size="hero" float style={s.hero} />}
    <Text accessibilityRole="header" style={[s.title, kind === 'welcome' && s.welcomeTitle]}>{title}</Text>
    <Text style={[s.body, kind === 'welcome' && s.welcomeBody]}>{body}</Text>
    <View style={s.visualArea}>
      {kind === 'relief' && <View style={s.thought}>
        <View style={s.thoughtRow}>
          <LottiMedallion pose="thinking" size="small" style={s.thinker} />
          <OnboardingSurface outerStyle={s.bubbleOuter} style={s.bubble}><Text style={s.caption}>{c.before}</Text><Text style={s.quote}>{c[challenge]}</Text></OnboardingSurface>
        </View>
        <IconSymbol name="arrow.down" size={23} color={brand.accent} />
      </View>}
      {kind === 'sharedValue' && support === 'together' && <View style={s.people}>
        <View style={s.person}><View style={s.avatar}><IconSymbol name="person.fill" size={28} color={brand.accentText} /></View><Text style={s.personLabel}>{c.you}</Text></View>
        <View style={s.link}>
          <View style={s.linkLine} />
          <LottiMedallion pose="heart" size={64} />
        </View>
        <View style={s.person}><View style={s.avatar}><IconSymbol name="person.fill" size={28} color={brand.accentText} /></View><Text style={s.personLabel}>{c.partner}</Text></View>
      </View>}
      <ProductPreview compact={kind === 'relief' || kind === 'sharedValue'} cardsOnly={kind === 'welcome'} locale={locale} need={kind === 'welcome' ? 'daily' : need} dueDate={dueDate} babyName={babyName} />
      {kind === 'sharedValue' && support === 'together' && <Text style={s.centered}>{c.linkNote}</Text>}
    </View>
  </View>;
}

export function FeedbackStep({ locale, helpful, onHelpful, onChooseAnother }: { locale: OnboardingLocale; helpful: boolean; onHelpful: () => void; onChooseAnother: () => void }) {
  const c = valueCopy(locale);
  return <View style={s.screen}><Text accessibilityRole="header" style={s.title}>{c.feedbackTitle}</Text><Text style={s.body}>{c.feedbackBody}</Text><View style={s.visualArea}>
    <LottiMedallion pose={helpful ? 'thumbsUp' : 'curious'} key={helpful ? 'helpful' : 'asking'} float style={s.medallion} />
    <OnboardingChoice selected={helpful} accessibilityLabel={c.yes} onPress={onHelpful} contentStyle={s.choice}><View style={s.choiceIcon}><IconSymbol name="checkmark" size={20} color={brand.accentText} /></View><Text style={s.choiceText}>{c.yes}</Text></OnboardingChoice>
    <OnboardingChoice accessibilityLabel={c.other} onPress={onChooseAnother} contentStyle={s.choice}><View style={s.choiceIcon}><IconSymbol name="arrow.left" size={20} color={brand.accentText} /></View><Text style={s.choiceText}>{c.other}</Text></OnboardingChoice>
  </View></View>;
}

export function HabitStep({ locale, need, habit, onSelect }: { locale: OnboardingLocale; need: OnboardingNeed; habit: OnboardingHabit | null; onSelect: (value: OnboardingHabit) => void }) {
  const c = valueCopy(locale);
  const t = (choice: OnboardingHabit) => translateOnboardingText(locale, `survey.habit${names[need]}${choice === 'in_moment' ? 'Now' : 'Quiet'}`);
  return <View style={s.screen}><Text accessibilityRole="header" style={s.title}>{c.habitTitle}</Text><Text style={s.body}>{translateOnboardingText(locale, 'survey.habitBody')}</Text><View style={s.visualArea}>
    <LottiMedallion pose={habit === 'quiet_moment' ? 'night' : habit === 'in_moment' ? 'star' : 'teddy'} key={habit ?? 'none'} float style={s.medallion} />
    {(['in_moment', 'quiet_moment'] as const).map(choice => <OnboardingChoice key={choice} selected={habit === choice} accessibilityLabel={t(choice)} onPress={() => onSelect(choice)} contentStyle={s.choice}><View style={s.choiceIcon}><IconSymbol name={choice === 'in_moment' ? 'sun.max.fill' : 'moon.fill'} size={22} color={brand.accentText} /></View><Text style={s.choiceText}>{t(choice)}</Text><IconSymbol name={habit === choice ? 'checkmark.circle.fill' : 'circle'} size={22} color={brand.accentText} /></OnboardingChoice>)}
    <Text style={s.caption}>{translateOnboardingText(locale, 'survey.habitNote')}</Text>
  </View></View>;
}

export const valueStyles = StyleSheet.create({
  screen: { flexGrow: 1, flexShrink: 0, gap: 16, paddingTop: 14, paddingBottom: 12 },
  title: { fontSize: 32, lineHeight: 39, letterSpacing: -0.5, fontWeight: '700', color: brand.text },
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
  weekCompact: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }, weekDisc: { alignSelf: 'center', width: 180, height: 180, alignItems: 'center', justifyContent: 'center' }, ring: { position: 'absolute', top: 0, left: 0 }, weekNumber: { fontSize: 52, fontWeight: '700', color: brand.text }, centered: { fontSize: 13, lineHeight: 20, color: brand.secondary, textAlign: 'center' },
  thought: { alignItems: 'center', gap: 12 }, thoughtRow: { flexDirection: 'row', alignItems: 'center', gap: 14, alignSelf: 'stretch' }, bubbleOuter: { flex: 1, minWidth: 0 }, thinker: { marginLeft: 11 }, bubble: { paddingVertical: 14, paddingHorizontal: 16, gap: 4 }, quote: { color: brand.text, fontSize: 19, lineHeight: 26, fontWeight: '600' }, people: { flexDirection: 'row', alignItems: 'flex-start' }, person: { width: 96, alignItems: 'center', gap: 8 }, personLabel: { fontSize: 12, lineHeight: 16, color: brand.secondary, textAlign: 'center' }, avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.45)', borderWidth: 1.5, borderColor: 'rgba(142,78,198,0.35)', justifyContent: 'center', alignItems: 'center' }, link: { flex: 1, height: 64, alignItems: 'center', justifyContent: 'center' }, linkLine: { position: 'absolute', left: -14, right: -14, top: 31, height: 2, borderWidth: 1, borderRadius: 1, borderStyle: 'dashed', borderColor: 'rgba(142,78,198,0.45)' },
  choice: { flexDirection: 'row', gap: 14, padding: 18, minHeight: 88, alignItems: 'center' },
  choiceIcon: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: 'rgba(255,255,255,0.72)', backgroundColor: 'rgba(255,255,255,0.28)', alignItems: 'center', justifyContent: 'center' }, medallion: { marginBottom: 8 },
  hero: { marginTop: 4, marginBottom: 10 }, welcomeTitle: { fontSize: 30, lineHeight: 37, textAlign: 'center' }, welcomeBody: { textAlign: 'center' }, choiceText: { flex: 1, fontSize: 17, lineHeight: 25, fontWeight: '600', color: brand.text },
});
