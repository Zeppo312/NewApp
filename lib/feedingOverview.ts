export type FeedingDetailKind = 'bottle' | 'breast' | 'solids';

export type FeedingDetailItem = {
  key: FeedingDetailKind;
  label: string;
  count: number;
};

export type FeedingOverview = {
  totalBottleMl: number;
  bottleCount: number;
  breastCount: number;
  solidsCount: number;
  totalFeedingCount: number;
  detailItems: FeedingDetailItem[];
};

export type FeedingEntryLike = {
  entry_type?: string | null;
  feeding_type?: string | null;
  sub_type?: string | null;
  feeding_volume_ml?: number | null;
};

const DETAIL_ORDER: FeedingDetailKind[] = ['bottle', 'breast', 'solids'];

const DETAIL_LABELS: Record<FeedingDetailKind, string> = {
  bottle: 'Flasche',
  breast: 'Stillen',
  solids: 'Beikost',
};

const resolveFeedingKind = (entry: FeedingEntryLike): FeedingDetailKind | null => {
  const feedingType = entry.feeding_type?.toUpperCase();
  if (feedingType === 'BOTTLE') return 'bottle';
  if (feedingType === 'BREAST') return 'breast';
  if (feedingType === 'SOLIDS') return 'solids';

  if (entry.sub_type === 'feeding_bottle') return 'bottle';
  if (entry.sub_type === 'feeding_breast') return 'breast';
  if (entry.sub_type === 'feeding_solids') return 'solids';

  return null;
};

const normalizeBottleVolume = (value: number | null | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  return value;
};

export const buildFeedingOverview = (entries: FeedingEntryLike[] | null | undefined): FeedingOverview => {
  let totalBottleMl = 0;
  let bottleCount = 0;
  let breastCount = 0;
  let solidsCount = 0;
  let totalFeedingCount = 0;

  for (const entry of entries ?? []) {
    if (entry?.entry_type !== 'feeding') continue;

    totalFeedingCount += 1;

    const kind = resolveFeedingKind(entry);
    if (kind === 'bottle') {
      bottleCount += 1;
      totalBottleMl += normalizeBottleVolume(entry.feeding_volume_ml);
      continue;
    }
    if (kind === 'breast') {
      breastCount += 1;
      continue;
    }
    if (kind === 'solids') {
      solidsCount += 1;
    }
  }

  const counts: Record<FeedingDetailKind, number> = {
    bottle: bottleCount,
    breast: breastCount,
    solids: solidsCount,
  };

  const detailItems: FeedingDetailItem[] = DETAIL_ORDER
    .filter((kind) => counts[kind] > 0)
    .map((kind) => ({
      key: kind,
      label: DETAIL_LABELS[kind],
      count: counts[kind],
    }));

  return {
    totalBottleMl: Math.round(totalBottleMl),
    bottleCount,
    breastCount,
    solidsCount,
    totalFeedingCount,
    detailItems,
  };
};
