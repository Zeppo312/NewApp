import type { DailySignals } from './types';

export type AdvisorPrimaryAction =
  | {
      kind: 'feeding';
      label: string;
      quickAction:
        | 'feeding'
        | 'feeding_breast'
        | 'feeding_bottle'
        | 'feeding_solids'
        | 'feeding_water';
    }
  | { kind: 'sleep'; label: string }
  | { kind: 'complete'; label: string }
  | { kind: 'daily'; label: string };

const feedingAction = (signals: DailySignals): AdvisorPrimaryAction => {
  switch (signals.feeding.likelyFeedingMode) {
    case 'breast':
      return { kind: 'feeding', label: 'Stillen eintragen', quickAction: 'feeding_breast' };
    case 'bottle':
      return { kind: 'feeding', label: 'Flasche eintragen', quickAction: 'feeding_bottle' };
    case 'solids':
      return signals.ageMonths != null && signals.ageMonths >= 6
        ? { kind: 'feeding', label: 'Trinken eintragen', quickAction: 'feeding_water' }
        : { kind: 'feeding', label: 'Mahlzeit eintragen', quickAction: 'feeding' };
    default:
      return { kind: 'feeding', label: 'Mahlzeit eintragen', quickAction: 'feeding' };
  }
};

export const getAdvisorPrimaryAction = (
  ruleId: string,
  signals: DailySignals,
): AdvisorPrimaryAction => {
  if (ruleId.includes('feeding')) return feedingAction(signals);
  if (ruleId.includes('sleep')) return { kind: 'sleep', label: 'Schlaf öffnen' };
  if (
    ruleId.includes('hot') ||
    ruleId.includes('cold') ||
    ruleId.includes('uv') ||
    ruleId.includes('rain')
  ) {
    return { kind: 'complete', label: 'Ich bin vorbereitet' };
  }
  return { kind: 'daily', label: 'Moment festhalten' };
};
