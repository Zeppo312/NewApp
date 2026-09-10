import { OnboardingChoice, OnboardingSurface } from './surfaces';
import { onboardingColors as brand } from '@/components/onboarding/theme';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SleepTimerFace } from '@/components/tracking/SleepTimerFace';
import { DailyQuickAction } from '@/components/tracking/DailyQuickAction';
import { PreviewActivity, exampleCareEntry } from './tracker-preview';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { getLocalizedBabySizeForWeek } from '@/lib/babySizeTranslations';
import { getOnboardingPregnancyProgress } from '@/lib/onboarding-flow';
import { getOnboardingNeeds, type OnboardingNeed, type OnboardingChallenge, type OnboardingSupport } from '@/lib/onboarding-personalization';
import { translateOnboardingText, type OnboardingLocale, type OnboardingTranslationKey } from '@/lib/onboardingTranslations';

const iconNames = { memories: 'book.fill', sleep: 'moon.fill', daily: 'sun.max.fill', overview: 'heart.fill', checklist: 'checklist', remember: 'clock', patterns: 'chart.bar.fill', coordination: 'person.2.fill', overload: 'leaf.fill', solo: 'person.fill', together: 'person.2.fill', later: 'clock' } as const;
export const howKeys = { memories: 'survey.howMemories', sleep: 'survey.howSleep', daily: 'survey.howDaily', overview: 'survey.howOverview', checklist: 'survey.howChecklist' } as const;
const whyKeys = { remember: 'survey.whyRemember', patterns: 'survey.whyPatterns', coordination: 'survey.whyCoordination', overload: 'survey.whyOverload' } as const;
const responseKeys = { remember: 'survey.responseRemember', patterns: 'survey.responsePatterns', coordination: 'survey.responseCoordination', overload: 'survey.responseOverload' } as const;
const demoNames = { memories: 'Memories', sleep: 'Sleep', daily: 'Daily', overview: 'Overview', checklist: 'Checklist' } as const;

export function SurveyStep({ locale, kind, isBabyBorn, value, onSelect }: {
  locale: OnboardingLocale; kind: 'needs' | 'challenge' | 'support'; isBabyBorn: boolean;
  value: OnboardingNeed | OnboardingChallenge | OnboardingSupport | null;
  onSelect: (value: string) => void;
}) {
  const t = (key: OnboardingTranslationKey) => translateOnboardingText(locale, key);
  const options = kind === 'needs' ? getOnboardingNeeds(isBabyBorn) : kind === 'challenge' ? ['remember', 'patterns', 'coordination', 'overload'] as const : ['solo', 'together', 'later'] as const;
  return <View style={styles.screen}>
    <Text accessibilityRole="header" style={styles.title}>{t(`survey.${kind}Title`)}</Text>
    <Text style={styles.body}>{t(`survey.${kind}Body`)}</Text>
    <View style={styles.options}>
      {options.map((option, index) => <OnboardingChoice key={option} selected={value === option} tone={[brand.softAccent, 'rgba(255,205,206,0.22)', 'rgba(230,204,178,0.25)'][index % 3]}
        accessibilityLabel={t(`${kind === 'needs' ? 'flow' : 'survey'}.${option}` as OnboardingTranslationKey)} accessibilityHint={t(`${kind === 'needs' ? 'flow' : 'survey'}.${option}Detail` as OnboardingTranslationKey)} onPress={() => onSelect(option)} contentStyle={styles.option}>
        <View style={styles.choiceIcon}><IconSymbol name={iconNames[option]} size={23} color={brand.accentText} /></View>
        <View style={styles.optionCopy}>
          <Text style={styles.optionTitle}>{t(`${kind === 'needs' ? 'flow' : 'survey'}.${option}` as OnboardingTranslationKey)}</Text>
          <Text style={styles.optionBody}>{t(`${kind === 'needs' ? 'flow' : 'survey'}.${option}Detail` as OnboardingTranslationKey)}</Text>
        </View>
        <View style={[styles.radio, value === option && styles.radioSelected]}>{value === option && <View style={styles.radioDot} />}</View>
      </OnboardingChoice>)}
    </View>
    {kind === 'challenge' && value && value in responseKeys && <Text accessibilityLiveRegion="polite" style={styles.response}>{t(responseKeys[value as OnboardingChallenge])}</Text>}
  </View>;
}

export function ProductTryout({ locale, need, dueDate, now, onCompletionChange }: {
  locale: OnboardingLocale; need: OnboardingNeed; dueDate: Date | null; now?: Date;
  onCompletionChange?: (completed: boolean) => void;
}) {
  const [active, setActive] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => { onCompletionChange?.(done); }, [done, onCompletionChange]);
  const [memory, setMemory] = useState('');
  const t = (key: OnboardingTranslationKey, params?: Record<string, number | string>) => translateOnboardingText(locale, key, params);
  useEffect(() => {
    if (startedAt === null || !active) return;
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [startedAt, active]);
  const pregnancy = getOnboardingPregnancyProgress(dueDate, now);
  const size = pregnancy && pregnancy.week >= 5 ? getLocalizedBabySizeForWeek(locale, pregnancy.week) : null;
  const reset = () => { setActive(false); setDone(false); setStartedAt(null); setSeconds(0); setMemory(''); };
  return <View style={styles.screen}>
    <Text style={styles.eyebrow}>{t('survey.demoLabel')}</Text>
    <Text accessibilityRole="header" style={styles.title}>{t(`survey.demo${demoNames[need]}Title`)}</Text>
    <Text style={styles.body}>{t(`survey.demo${demoNames[need]}Body`)}</Text>
    <OnboardingSurface style={styles.demo} tone={brand.softAccent}>
      {need !== 'sleep' && need !== 'daily' && <View style={styles.symbol}><IconSymbol name={iconNames[need]} size={36} color={brand.accentText} /></View>}
      {need === 'sleep' && <>
        <SleepTimerFace size={230} active={active || done} progress={seconds / (8 * 60 * 60) * 100} timeLabel={[Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':')} textColor={brand.text}><Text style={[styles.demoBody, { maxWidth: 180, fontWeight: '600', color: brand.text }]}>{t(done ? 'survey.timerSaved' : active ? 'survey.timerRunning' : 'survey.timerReady')}</Text></SleepTimerFace>
        {!done && <Pressable accessibilityRole="button" style={styles.action} onPress={() => {
          if (active) { setSeconds(Math.max(0, Math.floor((Date.now() - (startedAt ?? Date.now())) / 1000))); setActive(false); setDone(true); }
          else { setStartedAt(Date.now()); setActive(true); }
        }}><Text style={styles.actionText}>{t(active ? 'survey.stopTimer' : 'survey.startTimer')}</Text></Pressable>}
      </>}
      {need === 'daily' && <>
        <Text accessibilityLiveRegion="polite" style={styles.demoTitle}>{t(done ? 'survey.feedingSaved' : 'survey.feedingReady')}</Text>
        {done ? <View style={{ alignSelf: 'stretch' }}><PreviewActivity entry={exampleCareEntry('daily')} /></View> : <DailyQuickAction emoji="🍼" label={t('survey.feedingAction')} textColor={brand.secondary} onPress={() => setDone(true)} />}
      </>}
      {need === 'checklist' && <>
        <Text style={styles.demoTitle}>{t(done ? 'survey.taskComplete' : 'survey.taskOpen')}</Text>
        <Pressable accessibilityRole="checkbox" accessibilityLabel={t('survey.task')} accessibilityState={{ checked: done }} onPress={() => setDone(value => !value)} style={styles.task}>
          <IconSymbol name={done ? 'checkmark.circle.fill' : 'circle'} size={23} color={brand.accentText} />
          <Text style={[styles.taskText, done && { textDecorationLine: 'line-through', color: brand.muted }]}>{t('survey.task')}</Text>
        </Pressable>
        <Text accessibilityLiveRegion="polite" style={styles.demoBody}>{t('survey.taskProgress', { count: done ? 1 : 0 })}</Text>
      </>}
      {need === 'memories' && <>
        <Text style={styles.demoTitle}>{t(done ? 'survey.memorySaved' : 'survey.memoryQuestion')}</Text>
        {done ? <Text selectable style={styles.demoBody}>{memory.trim()}</Text> : <>
          <TextInput accessibilityLabel={t('survey.memoryQuestion')} placeholder={t('survey.memoryPlaceholder')} placeholderTextColor={brand.muted} value={memory} onChangeText={setMemory} maxLength={180} multiline style={styles.memoryInput} />
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: !memory.trim() }} disabled={!memory.trim()} style={[styles.action, !memory.trim() && { opacity: 0.45 }]} onPress={() => setDone(true)}><Text style={styles.actionText}>{t('survey.memoryAction')}</Text></Pressable>
        </>}
      </>}
      {need === 'overview' && <>
        <Text style={styles.demoTitle}>{pregnancy ? t('moment.week', { week: pregnancy.week }) : t('flow.overview')}</Text>
        {pregnancy && <Text selectable style={styles.demoBody}>{t('moment.weekDetail', { weeks: pregnancy.completedWeeks, days: pregnancy.day })}</Text>}
        {size ? <>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: done }} style={styles.action} onPress={() => setDone(value => !value)}><Text style={styles.actionText}>{t(done ? 'moment.hideSize' : 'moment.showSize')}</Text></Pressable>
          {done && <Text selectable accessibilityLiveRegion="polite" style={styles.demoTitle}>{t('moment.comparison', { comparison: size.fruitComparison })}</Text>}
        </> : <Text style={styles.demoBody}>{t('survey.noWeek')}</Text>}
      </>}
      {done && need !== 'overview' && <Pressable accessibilityRole="button" style={styles.reset} onPress={reset}><Text style={styles.resetText}>{t('survey.reset')}</Text></Pressable>}
    </OnboardingSurface>
    {done && <OnboardingSurface tone={brand.softAccent} style={styles.aha}><IconSymbol name="checkmark.circle.fill" size={23} color={brand.accentText} /><Text accessibilityLiveRegion="polite" style={styles.ahaText}>{t(`survey.aha${demoNames[need]}`)}</Text></OnboardingSurface>}
    <Text style={styles.note}>{t(need === 'overview' ? 'moment.sizeNote' : 'survey.demoNote')}</Text>
  </View>;
}

export function BenefitStep({ locale, need, challenge }: { locale: OnboardingLocale; need: OnboardingNeed; challenge: OnboardingChallenge }) {
  const t = (key: OnboardingTranslationKey) => translateOnboardingText(locale, key);
  return <View style={styles.screen}>
    <Text style={styles.eyebrow}>{t('survey.afterTitle')}</Text>
    <Text accessibilityRole="header" style={styles.title}>{t(`flow.${need}`)}</Text>
    <OnboardingSurface style={styles.answerEcho} tone={brand.softAccent}><IconSymbol name={iconNames[challenge]} size={23} color={brand.accentText} /><Text style={styles.echoText}>{t(`survey.${challenge}`)}</Text></OnboardingSurface>
    <OnboardingSurface style={styles.explanation}><Text style={styles.explanationLabel}>{t('survey.howLabel')}</Text><Text style={styles.explanationText}>{t(howKeys[need])}</Text></OnboardingSurface>
    <OnboardingSurface style={styles.explanation}><Text style={styles.explanationLabel}>{t('survey.whyLabel')}</Text><Text style={styles.explanationText}>{t(whyKeys[challenge])}</Text></OnboardingSurface>
  </View>;
}

export const styles = StyleSheet.create({
  feedback: { gap: 12, alignItems: 'stretch' },
  feedbackChoice: { padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' },
  feedbackText: { flex: 1, color: brand.text, fontSize: 15, lineHeight: 22 },
  response: { color: brand.accentText, fontSize: 14, lineHeight: 22, textAlign: 'center', paddingHorizontal: 12 },
  aha: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 18 },
  ahaText: { flex: 1, color: brand.secondary, fontSize: 15, lineHeight: 23 },
  choiceIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.55)', alignItems: 'center', justifyContent: 'center' },
  memoryInput: { alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, minHeight: 90, fontSize: 16, lineHeight: 23, color: brand.text, textAlignVertical: 'top' },
  screen: { flexGrow: 1, flexShrink: 0, gap: 18, paddingVertical: 14 }, title: { color: brand.text, fontSize: 34, lineHeight: 41, letterSpacing: -0.9, fontWeight: '700' }, body: { color: brand.secondary, fontSize: 17, lineHeight: 25 },
  eyebrow: { fontSize: 11, letterSpacing: 1.5, color: brand.accentText, textAlign: 'center', fontWeight: '700' },
  options: { flexGrow: 1, flexShrink: 0, justifyContent: 'center', gap: 12, paddingVertical: 26 }, option: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, minHeight: 90 }, selected: { borderColor: brand.accent, backgroundColor: brand.selected }, optionCopy: { flex: 1, gap: 5 }, optionTitle: { color: brand.text, fontSize: 16, lineHeight: 21, fontWeight: '600' }, optionBody: { color: brand.secondary, fontSize: 13, lineHeight: 19 }, radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: '#B4A0B9', alignItems: 'center', justifyContent: 'center' }, radioSelected: { backgroundColor: brand.accentText, borderColor: brand.accentText }, radioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
  demo: { padding: 24, gap: 20, alignItems: 'center', marginTop: 10 }, symbol: { width: 80, height: 80, borderRadius: 40, backgroundColor: brand.white, alignItems: 'center', justifyContent: 'center' }, demoTitle: { color: brand.text, fontSize: 22, lineHeight: 28, textAlign: 'center', fontWeight: '600' }, demoBody: { color: brand.secondary, fontSize: 14, lineHeight: 21, textAlign: 'center' }, timer: { fontSize: 58, lineHeight: 65, fontWeight: '600', fontVariant: ['tabular-nums'], color: brand.text }, action: { minHeight: 52, borderRadius: 26, paddingVertical: 14, paddingHorizontal: 20, backgroundColor: brand.accent, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' }, actionText: { color: brand.white, textAlign: 'center', fontWeight: '600', fontSize: 15, lineHeight: 21 }, reset: { padding: 10, minHeight: 44 }, resetText: { color: brand.accentText, fontSize: 14 }, note: { color: brand.muted, fontSize: 12, lineHeight: 18, textAlign: 'center' }, task: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', padding: 18, borderRadius: 16, alignSelf: 'stretch' }, taskText: { flex: 1, color: brand.text, fontSize: 16, lineHeight: 23 },
  answerEcho: { padding: 20, borderRadius: 20, flexDirection: 'row', gap: 14, alignItems: 'center' }, echoText: { flex: 1, fontSize: 19, lineHeight: 26, fontWeight: '600', color: brand.text }, explanation: { gap: 10, padding: 20 }, explanationLabel: { color: brand.text, fontSize: 18, fontWeight: '700' }, explanationText: { color: brand.secondary, fontSize: 17, lineHeight: 27 },
});
