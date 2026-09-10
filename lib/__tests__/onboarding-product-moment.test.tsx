import React from 'react';
import { Dimensions, Text, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { OnboardingProductMoment } from '../../components/onboarding/product-moment';
import { SurveyStep, ProductTryout, BenefitStep } from '../../components/onboarding/personalized-steps';
import { FeedbackStep, HabitStep, ValueStep, ProductPreview } from '../../components/onboarding/value-steps';
import { WellbeingStep, wellbeingSummary } from '../../components/onboarding/wellbeing-step';
import Slider from '@react-native-community/slider';
import { SleepTimerFace } from '../../components/tracking/SleepTimerFace';
import ActivityCard from '../../components/ActivityCard';
import { getOnboardingNeeds, getPersonalizedStart } from '../onboarding-personalization';

jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light', hasCustomBackground: false, isDarkBackground: false }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => ({
  ...require('react-native-reanimated/mock'),
  useReducedMotion: () => false,
  cubicBezier: () => 'ease-out',
}));

describe('personalized onboarding', () => {
  let tree: ReactTestRenderer;
  beforeEach(() => Dimensions.set({ window: { width: 390, height: 844, scale: 3, fontScale: 1 }, screen: { width: 390, height: 844, scale: 3, fontScale: 1 } }));
  afterEach(() => { act(() => tree?.unmount()); jest.useRealTimers(); });
  const text = () => tree.root.findAllByType(Text).map(node => node.props.children).flat().join(' ');
  const press = (label: string) => {
    const button = tree.root.findAll(node => typeof node.props.onPress === 'function').find(node =>
      node.props.accessibilityLabel === label || node.findAllByType(Text).some(child => child.props.children === label),
    );
    expect(button).toBeDefined();
    act(() => button!.props.onPress());
  };

  it('keeps wellbeing unanswered until a parent chooses and allows clearing an answer', () => {
    const onChange = jest.fn();
    act(() => { tree = create(<WellbeingStep locale="de" kind="mood" value={null} onChange={onChange} />); });
    expect(onChange).not.toHaveBeenCalled();
    press('Gemischt'); expect(onChange).toHaveBeenLastCalledWith(3);
    act(() => tree.update(<WellbeingStep locale="de" kind="mood" value={3} onChange={onChange} />));
    act(() => tree.root.findByType(Slider).props.onValueChange(2));
    expect(onChange).toHaveBeenLastCalledWith(2);
    press('Antwort zurücksetzen'); expect(onChange).toHaveBeenLastCalledWith(null);
  });
  it('reflects low energy in the final plan and preserves the answer on rerender', () => {
    act(() => { tree = create(<WellbeingStep locale="de" kind="energy" value={1} onChange={jest.fn()} />); });
    expect(tree.root.findByType(Slider).props.value).toBe(1);
    expect(text()).toContain('Pausen zählen auch.');
    expect(wellbeingSummary('de', { mood: null, energy: 1 })).toContain('Ein kleiner Einstieg reicht.');
    act(() => tree.update(<OnboardingProductMoment locale="de" isBabyBorn isPartner={false} dueDate={null} selectedStart="daily" support="solo" wellbeing={{ mood: null, energy: 1 }} />));
    expect(text()).toContain('Auch du zählst');
    expect(text()).toContain('Ein kleiner Einstieg reicht.');
  });
  it('reuses real tracker cards in read-only mode for example entries', () => {
    act(() => { tree = create(<ProductPreview locale="de" need="daily" />); });
    const cards = tree.root.findAllByType(ActivityCard);
    expect(cards).toHaveLength(2);
    expect(cards.every(card => card.props.readOnly)).toBe(true);
    expect(cards.map(card => card.props.entry.entry_type)).toEqual(['feeding', 'sleep']);
  });
  it('keeps the full sleep clock on the feature page, with only one card on supporting pages', () => {
    act(() => { tree = create(<ValueStep kind="personalValue" locale="de" need="sleep" />); });
    expect(tree.root.findAllByType(SleepTimerFace)).toHaveLength(1);
    for (const kind of ['relief', 'sharedValue'] as const) {
      act(() => tree.update(<ValueStep kind={kind} locale="de" need="sleep" support="together" />));
      expect(tree.root.findAllByType(SleepTimerFace)).toHaveLength(0);
      expect(tree.root.findAllByType(ActivityCard)).toHaveLength(1);
      expect(text()).not.toContain('So kann es aussehen');
    }
  });
  it('prioritizes readable activity cards over fixed-size decoration with larger text', () => {
    Dimensions.set({ window: { width: 390, height: 844, scale: 3, fontScale: 2 } });
    act(() => { tree = create(<ProductPreview locale="de" need="sleep" />); });
    expect(tree.root.findAllByType(SleepTimerFace)).toHaveLength(0);
    expect(tree.root.findAllByType(ActivityCard)).toHaveLength(1);
    expect(text()).toContain('09:05');
  });
  it('keeps the final screen focused on next steps without repeating sample records', () => {
    act(() => { tree = create(<OnboardingProductMoment locale="de" isBabyBorn isPartner={false} dueDate={null} selectedStart="sleep" support="together" habit="quiet_moment" wellbeing={{ mood: 4, energy: 3 }} />); });
    expect(tree.root.findAllByType(ActivityCard)).toHaveLength(0);
    expect(text()).toContain('Auch du zählst');
    expect(text()).toContain('Das nächste Schläfchen mit Start und Ende eintragen.');
  });
  it('offers stage-appropriate priorities and rejects stale choices after changing stage', () => {
    expect(getOnboardingNeeds(false)).toEqual(['overview', 'checklist', 'memories']);
    expect(getPersonalizedStart(false, 'sleep')).toBe('overview');
    expect(getPersonalizedStart(true, 'checklist')).toBe('daily');
    expect(getPersonalizedStart(true, 'memories')).toBe('memories');
  });
  it('reports an explicit priority selection to the parent flow', () => {
    const onSelect = jest.fn();
    act(() => { tree = create(<SurveyStep locale="de" kind="needs" isBabyBorn value={null} onSelect={onSelect} />); });
    press('Schlaf einfach festhalten');
    expect(onSelect).toHaveBeenCalledWith('sleep');
    expect(text()).not.toContain('Deine Schwangerschaft');
  });
  it('runs and stops a real local example timer, and cleans up the interval', () => {
    jest.useFakeTimers();
    act(() => { tree = create(<ProductTryout locale="de" need="sleep" dueDate={null} />); });
    expect(text()).not.toContain('Du siehst die Schlafzeit hier.');
    press('Schlaf starten');
    act(() => jest.advanceTimersByTime(65000));
    expect(text()).toContain('00:01:05');
    press('Aufwachen festhalten');
    expect(text()).toContain('Schlafzeit festgehalten');
    expect(text()).toContain('Du siehst die Schlafzeit hier.');
    expect(jest.getTimerCount()).toBe(0);
    press('Noch einmal ausprobieren');
    expect(text()).toContain('Bereit für eine Schlafpause');
    expect(text()).not.toContain('Du siehst die Schlafzeit hier.');
  });
  it('lets an expecting parent check off a task without newborn tracking', () => {
    act(() => { tree = create(<ProductTryout locale="de" need="checklist" dueDate={null} />); });
    press('Kliniktasche vorbereiten');
    expect(text()).toContain('1 von 1 erledigt');
    expect(text()).toContain('wird nicht gespeichert');
    expect(text()).not.toContain('Mahlzeit');
  });
  it('lets parents create and reset a local meal preview', () => {
    act(() => { tree = create(<ProductTryout locale="de" need="daily" dueDate={null} />); });
    press('Mahlzeit eintragen');
    expect(text()).toContain('120ml');
    expect(text()).toContain('08:10');
    press('Noch einmal ausprobieren');
    expect(text()).toContain('Mahlzeit eintragen');
  });
  it('reports completed and reset demo states without forcing feedback inside the preview', () => {
    const onCompletionChange = jest.fn();
    act(() => { tree = create(<ProductTryout locale="de" need="daily" dueDate={null} onCompletionChange={onCompletionChange} />); });
    expect(onCompletionChange).toHaveBeenLastCalledWith(false);
    press('Mahlzeit eintragen');
    expect(onCompletionChange).toHaveBeenLastCalledWith(true);
    press('Noch einmal ausprobieren');
    expect(onCompletionChange).toHaveBeenLastCalledWith(false);
  });
  it('lets parents confirm the preview or return to choosing another goal on its own screen', () => {
    const onHelpful = jest.fn(); const onChooseAnother = jest.fn();
    act(() => { tree = create(<FeedbackStep locale="de" helpful={false} onHelpful={onHelpful} onChooseAnother={onChooseAnother} />); });
    press('Ja, das passt zu mir'); expect(onHelpful).toHaveBeenCalledTimes(1);
    press('Ich möchte etwas anderes sehen'); expect(onChooseAnother).toHaveBeenCalledTimes(1);
  });
  it('matches product views to the need without the removed example caption', () => {
    act(() => { tree = create(<ProductPreview locale="de" need="checklist" />); });
    expect(text()).toContain('1 von 3 erledigt');
    expect(text()).not.toContain('Beispiel');
    expect(text()).not.toContain('Mahlzeit');
    act(() => tree.update(<ProductPreview locale="de" need="sleep" />));
    expect(text()).toContain('00:45:00');
    expect(text()).toContain('09:05');
    expect(text()).toContain('09:50');
    expect(text()).not.toContain('Kliniktasche');
  });
  it('explains that shared views require linking, while a solo path stands on its own', () => {
    act(() => { tree = create(<ValueStep kind="sharedValue" locale="de" need="daily" support="together" />); });
    expect(text()).toContain('Gemeinsame Ansicht nach Kontoverknüpfung');
    act(() => tree.update(<ValueStep kind="sharedValue" locale="de" need="daily" support="solo" />));
    expect(text()).not.toContain('Verknüpfte Person');
    expect(text()).toContain('auch wenn gerade niemand mitdenken kann');
  });
  it('requires text for a memory and keeps it only in the resettable preview', () => {
    act(() => { tree = create(<ProductTryout locale="de" need="memories" dueDate={null} />); });
    expect(tree.root.findAll(node => node.props.disabled === true).length).toBeGreaterThan(0);
    act(() => tree.root.findByType(TextInput).props.onChangeText('Ein schöner Augenblick'));
    press('Als Vorschau festhalten');
    expect(text()).toContain('Ein schöner Augenblick');
    press('Noch einmal ausprobieren');
    expect(tree.root.findByType(TextInput).props.value).toBe('');
  });
  it('shows the actual pregnancy week and reveals its localized comparison', () => {
    act(() => { tree = create(<ProductTryout locale="en" need="overview" dueDate={new Date(2027, 0, 7)} now={new Date(2026, 8, 9)} />); });
    expect(text()).toContain('Week 23');
    press('See the size comparison');
    expect(text()).toContain('About the size of');
  });
  it('uses the chosen difficulty to explain the feature benefit', () => {
    act(() => { tree = create(<BenefitStep locale="de" need="sleep" challenge="overload" />); });
    expect(text()).toContain('Es ist einfach ganz schön viel');
    expect(text()).toContain('Du kannst mit genau einer Funktion anfangen.');
    expect(text()).toContain('Start und Ende werden als Schlafzeit festgehalten.');
  });
  it('carries the chosen starting point and sharing preference to the final plan', () => {
    act(() => { tree = create(<OnboardingProductMoment locale="de" isBabyBorn isPartner={false} babyName="Mia" dueDate={null} selectedStart="sleep" support="solo" />); });
    expect(text()).toContain('Für Mia');
    expect(text()).toContain('Das nächste Schläfchen mit Start und Ende eintragen.');
    expect(text()).toContain('Du startest für dich.');
    expect(text()).not.toContain('Mahlzeit ausprobieren');
  });
  it('lets parents choose a relevant everyday cue without promising a reminder', () => {
    const onSelect = jest.fn();
    act(() => { tree = create(<HabitStep locale="de" need="memories" habit={null} onSelect={onSelect} />); });
    press('Am Ende des Tages');
    expect(onSelect).toHaveBeenCalledWith('quiet_moment');
    expect(text()).toContain('es wird keine Erinnerung eingeschaltet');
    act(() => tree.update(<OnboardingProductMoment locale="de" isBabyBorn isPartner={false} dueDate={null} selectedStart="memories" support="solo" habit="quiet_moment" />));
    expect(text()).toContain('Am Ende des Tages');
    expect(text()).toContain('Eine erste kleine Geschichte ins Tagebuch schreiben.');
    expect(text()).not.toContain('Bei der nächsten Schlafpause');
  });
});
