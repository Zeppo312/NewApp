import { differenceInCalendarDays } from 'date-fns';

export type OnboardingStep =
  | 'welcome' | 'firstName' | 'role' | 'invitation' | 'babyStatus' | 'dates'
  | 'mood' | 'energy' | 'needs' | 'personalValue' | 'challenge' | 'relief' | 'support'
  | 'sharedValue' | 'productMoment' | 'feedback' | 'habit' | 'plan';

export function getOnboardingSteps(showInvitation: boolean, isLinked: boolean): OnboardingStep[] {
  return [
    'welcome', 'firstName', 'role',
    ...(showInvitation ? ['invitation' as const] : []),
    ...(isLinked ? [] : ['babyStatus', 'dates'] as const),
    'mood', 'energy', 'needs', 'personalValue', 'challenge', 'relief', 'support',
    'sharedValue', 'productMoment', 'feedback', 'habit', 'plan',
  ];
}

/** Unused demos do not lead to a question about an experience the parent did not have. */
export function getNextOnboardingIndex(steps: OnboardingStep[], current: number, demoCompleted: boolean) {
  return steps[current] === 'productMoment' && !demoCompleted ? steps.indexOf('habit') : current + 1;
}

export function getPreviousOnboardingIndex(steps: OnboardingStep[], current: number, demoCompleted: boolean) {
  return steps[current] === 'habit' && !demoCompleted ? steps.indexOf('productMoment') : Math.max(0, current - 1);
}

export type OnboardingStart = 'daily' | 'sleep' | 'overview' | 'checklist' | 'memories';

export function getOnboardingDestination(isBabyBorn: boolean, start?: OnboardingStart) {
  if (start === 'memories') return '/(tabs)/diary' as const;
  if (isBabyBorn && start === 'daily') return '/(tabs)/daily_old' as const;
  if (isBabyBorn && start === 'sleep') return '/(tabs)/sleep-tracker' as const;
  if (!isBabyBorn && start === 'checklist') return '/(tabs)/explore' as const;
  return isBabyBorn ? '/(tabs)/home' as const : '/(tabs)/pregnancy-home' as const;
}

/** Calendar days avoid a one-day jump at daylight-saving transitions. */
export function getOnboardingPregnancyProgress(dueDate: Date | null, now = new Date()) {
  if (!dueDate || !Number.isFinite(dueDate.getTime()) || !Number.isFinite(now.getTime())) return null;
  const daysUntilDue = differenceInCalendarDays(dueDate, now);
  const daysPregnant = 280 - daysUntilDue;
  // Do not invent a week when an implausible or very old date was supplied.
  if (daysPregnant < 0 || daysPregnant >= 294) return null;
  return {
    week: Math.floor(daysPregnant / 7) + 1,
    completedWeeks: Math.floor(daysPregnant / 7),
    day: daysPregnant % 7,
    daysUntilDue,
    progress: Math.min(1, daysPregnant / 280),
  };
}
