import {
  getOnboardingChapters,
  getOnboardingDestination,
  getOnboardingPregnancyProgress,
  getOnboardingSteps,
  getNextOnboardingIndex,
  getPreviousOnboardingIndex,
} from '../onboarding-flow';

describe('onboarding flow', () => {
  it('reaches a product moment without asking for a surname, photo, or background', () => {
    expect(getOnboardingSteps(true, false)).toEqual([
      'welcome', 'firstName', 'role', 'invitation', 'babyStatus', 'dates', 'mood', 'energy', 'needs', 'challenge', 'support', 'sharedValue', 'productMoment', 'feedback', 'habit', 'plan',
    ]);
  });

  it('explains the free week right before the paywall only where the store grants it', () => {
    const steps = getOnboardingSteps(false, false, true);
    expect(steps.at(-1)).toBe('trial');
    expect(steps.at(-2)).toBe('plan');
    expect(getOnboardingSteps(false, true, true)).not.toContain('trial');
    expect(getOnboardingChapters(steps, steps.indexOf('trial')).active).toBe('start');
  });

  it('uses the linked baby instead of asking an invited parent to enter baby details again', () => {
    expect(getOnboardingSteps(true, true)).toEqual(['welcome', 'firstName', 'role', 'invitation']);
    expect(getOnboardingSteps(false, true)).toEqual(['welcome', 'firstName', 'role', 'invitation']);
  });

  it('skips demo feedback in both directions when no action was completed', () => {
    const steps = getOnboardingSteps(false, false);
    const demo = steps.indexOf('productMoment');
    const habit = steps.indexOf('habit');
    expect(steps[getNextOnboardingIndex(steps, demo, false)]).toBe('habit');
    expect(steps[getPreviousOnboardingIndex(steps, habit, false)]).toBe('productMoment');
    expect(steps[getNextOnboardingIndex(steps, demo, true)]).toBe('feedback');
    expect(steps[getPreviousOnboardingIndex(steps, habit, true)]).toBe('feedback');
  });

  it('groups progress into chapters that fill one after another', () => {
    const steps = getOnboardingSteps(false, false);
    expect(getOnboardingChapters(steps, 0)).toMatchObject({ active: null, activeIndex: -1 });
    expect(getOnboardingChapters(steps, 0).chapters.map(chapter => chapter.key)).toEqual(['about', 'baby', 'feeling', 'everyday', 'start']);
    const atDates = getOnboardingChapters(steps, steps.indexOf('dates'));
    expect(atDates.active).toBe('baby');
    expect(atDates.chapters.map(chapter => chapter.fill)).toEqual([1, 1, 0, 0, 0]);
    expect(getOnboardingChapters(steps, steps.indexOf('challenge')).chapters[3].fill).toBe(0.5);
    expect(getOnboardingChapters(steps, steps.indexOf('support')).chapters[3].fill).toBe(0.75);
  });

  it('shows a single chapter for an invited parent', () => {
    const steps = getOnboardingSteps(false, true);
    const progress = getOnboardingChapters(steps, steps.indexOf('role'));
    expect(progress.chapters).toEqual([{ key: 'about', fill: 2 / 3 }]);
  });

  it('continues to the corresponding home after access is resolved', () => {
    expect(getOnboardingDestination(true)).toBe('/(tabs)/home');
    expect(getOnboardingDestination(false)).toBe('/(tabs)/pregnancy-home');
    expect(getOnboardingDestination(true, 'sleep')).toBe('/(tabs)/sleep-tracker');
    expect(getOnboardingDestination(true, 'daily')).toBe('/(tabs)/daily_old');
    expect(getOnboardingDestination(false, 'checklist')).toBe('/(tabs)/explore');
    expect(getOnboardingDestination(false, 'memories')).toBe('/(tabs)/pregnancy-home');
    expect(getOnboardingDestination(false, 'sleep')).toBe('/(tabs)/pregnancy-home');
  });
});

describe('onboarding pregnancy progress', () => {
  const now = new Date(2026, 8, 9, 12);

  it('uses completed weeks plus days and a one-based week label', () => {
    const due = new Date(2026, 8, 9 + 120, 0);
    expect(getOnboardingPregnancyProgress(due, now)).toMatchObject({
      week: 23, completedWeeks: 22, day: 6, daysUntilDue: 120,
    });
  });

  it('handles the due date and an overdue pregnancy without negative remaining days in the progress bar', () => {
    expect(getOnboardingPregnancyProgress(now, now)).toMatchObject({ daysUntilDue: 0, progress: 1 });
    expect(getOnboardingPregnancyProgress(new Date(2026, 8, 7), now))
      .toMatchObject({ daysUntilDue: -2, completedWeeks: 40, day: 2, progress: 1 });
  });

  it('uses calendar dates even when times differ around a daylight-saving transition', () => {
    expect(getOnboardingPregnancyProgress(new Date(2026, 2, 30, 0), new Date(2026, 2, 28, 23)))
      .toMatchObject({ daysUntilDue: 2 });
  });

  it('does not invent a pregnancy week for missing or implausible dates', () => {
    expect(getOnboardingPregnancyProgress(null, now)).toBeNull();
    expect(getOnboardingPregnancyProgress(new Date('invalid'), now)).toBeNull();
    expect(getOnboardingPregnancyProgress(new Date(2028, 0, 1), now)).toBeNull();
    expect(getOnboardingPregnancyProgress(new Date(2025, 0, 1), now)).toBeNull();
  });
});
