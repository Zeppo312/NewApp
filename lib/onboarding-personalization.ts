import type { OnboardingStart } from './onboarding-flow';

export type OnboardingNeed = 'sleep' | 'daily' | 'overview' | 'checklist' | 'memories';
export type OnboardingChallenge = 'remember' | 'patterns' | 'coordination' | 'overload';
export type OnboardingHabit = 'in_moment' | 'quiet_moment';
export type OnboardingSupport = 'solo' | 'together' | 'later';
export type OnboardingWellbeing = { mood: number | null; energy: number | null };
export type OnboardingAnswers = {
  version: 1;
  need: OnboardingNeed;
  challenge: OnboardingChallenge;
  support: OnboardingSupport;
  habit?: OnboardingHabit | null;
  wellbeing?: OnboardingWellbeing;
};
export function getOnboardingNeeds(isBabyBorn: boolean): OnboardingNeed[] {
  return isBabyBorn ? ['sleep', 'daily', 'memories'] : ['overview', 'checklist', 'memories'];
}
export function getPersonalizedStart(isBabyBorn: boolean, need: OnboardingNeed | null): OnboardingStart {
  return need && getOnboardingNeeds(isBabyBorn).includes(need) ? need : isBabyBorn ? 'daily' : 'overview';
}
