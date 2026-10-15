import { differenceInCalendarDays } from 'date-fns';

export type OnboardingStep =
  | 'welcome' | 'firstName' | 'role' | 'invitation' | 'babyStatus' | 'dates'
  | 'mood' | 'energy' | 'needs' | 'challenge' | 'support'
  | 'sharedValue' | 'productMoment' | 'feedback' | 'habit' | 'plan' | 'trial';

/** The trial explanation is only shown where the store actually grants the free week (iOS intro offer). */
export function getOnboardingSteps(showInvitation: boolean, isLinked: boolean, showTrial = false): OnboardingStep[] {
  if (isLinked) return ['welcome', 'firstName', 'role', 'invitation'];
  return [
    'welcome', 'firstName', 'role',
    ...(showInvitation ? ['invitation' as const] : []),
    'babyStatus', 'dates',
    'mood', 'energy', 'needs', 'challenge', 'support',
    'sharedValue', 'productMoment', 'feedback', 'habit', 'plan',
    ...(showTrial ? ['trial' as const] : []),
  ];
}

export type OnboardingChapter = 'about' | 'baby' | 'feeling' | 'everyday' | 'start';

const chapterOfStep: Record<OnboardingStep, OnboardingChapter | null> = {
  welcome: null,
  firstName: 'about', role: 'about', invitation: 'about',
  babyStatus: 'baby', dates: 'baby',
  mood: 'feeling', energy: 'feeling',
  needs: 'everyday', challenge: 'everyday', support: 'everyday', sharedValue: 'everyday',
  productMoment: 'start', feedback: 'start', habit: 'start', plan: 'start', trial: 'start',
};

/** Groups the long flow into a few chapters, each with its own fill, so progress stays readable. */
export function getOnboardingChapters(steps: OnboardingStep[], current: number) {
  const chapters: { key: OnboardingChapter; fill: number }[] = [];
  for (const key of steps.map(step => chapterOfStep[step])) {
    if (key && !chapters.some(chapter => chapter.key === key)) chapters.push({ key, fill: 0 });
  }
  const active = chapterOfStep[steps[current]];
  for (const chapter of chapters) {
    const indices = steps.flatMap((step, index) => chapterOfStep[step] === chapter.key ? [index] : []);
    const done = indices.filter(index => index <= current).length;
    chapter.fill = done / indices.length;
  }
  const activeIndex = active ? chapters.findIndex(chapter => chapter.key === active) : -1;
  return { chapters, active, activeIndex };
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
  // Legacy preferences use the same fallback as getPersonalizedStart.
  if (start === 'memories') start = isBabyBorn ? 'daily' : 'overview';
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
