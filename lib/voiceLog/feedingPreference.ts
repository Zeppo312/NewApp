export type RecentMilkFeedingType = 'BREAST' | 'BOTTLE';

const isMilkFeedingType = (value: unknown): value is RecentMilkFeedingType =>
  value === 'BREAST' || value === 'BOTTLE';

/**
 * Ermittelt aus den neuesten Einträgen die übliche Milch-Fütterung.
 * Die Mehrheit der letzten fünf gültigen Einträge gewinnt; bei Gleichstand
 * entscheidet der neueste Eintrag (das Array muss absteigend sortiert sein).
 */
export const inferRecentMilkPreference = (
  feedingTypes: readonly unknown[],
): RecentMilkFeedingType | null => {
  const recentTypes = feedingTypes.filter(isMilkFeedingType).slice(0, 5);
  if (recentTypes.length === 0) return null;

  const breastCount = recentTypes.filter((type) => type === 'BREAST').length;
  const bottleCount = recentTypes.length - breastCount;

  if (breastCount === bottleCount) return recentTypes[0];
  return breastCount > bottleCount ? 'BREAST' : 'BOTTLE';
};
